package com.mossesx.xtext.engine

import android.content.Context
import com.mossesx.xtext.R
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.MessageSource

/**
 * Runs the hands-free conversation for one message:
 *
 *   announce -> (reply | repeat | read more | call back | ignore)
 *   reply    -> dictate -> confirm (send | change | cancel) -> send
 *
 * Everything runs on the main thread, driven by Speaker / Listener callbacks.
 */
class ConversationRunner(
    private val context: Context,
    private val prefs: Prefs,
    private val log: ActivityLog,
    private val speaker: Speaker,
    private val listener: Listener,
    private val sender: MessageSender,
    private val contacts: ContactResolver,
) {

    enum class Outcome { DONE, STOPPED }

    /** Whether the service currently holds microphone access (foreground service with microphone type). */
    var micAvailable: Boolean = false

    val isActive: Boolean get() = active

    private var active = false
    private lateinit var message: IncomingMessage
    private var onFinished: ((Outcome) -> Unit)? = null

    private var spokenBody = ""
    private var fullBody = ""
    private var truncated = false
    private var draft = ""
    private var commandRetries = 0
    private var dictationRetries = 0
    private var confirmRetries = 0

    fun run(msg: IncomingMessage, onFinished: (Outcome) -> Unit) {
        abort()
        message = msg
        this.onFinished = onFinished
        active = true
        commandRetries = 0
        dictationRetries = 0
        confirmRetries = 0
        draft = ""

        val cleaned = TextCleaner.clean(msg.body, prefs.maxChars)
        spokenBody = cleaned.text
        truncated = cleaned.truncated
        fullBody = if (truncated) TextCleaner.clean(msg.body, 0).text else spokenBody
        announce()
    }

    /** Stops the current conversation immediately without a callback. */
    fun abort() {
        if (!active) return
        active = false
        onFinished = null
        speaker.stop()
        listener.cancel()
    }

    // ---- announce ------------------------------------------------------

    private fun announce() {
        val intro = buildIntro()
        val text = if (canPrompt()) intro + " " + promptText() else intro
        speaker.speak(text) { if (active) afterAnnounce() }
    }

    private fun buildIntro(): String {
        val who = spokenSender()
        val app = message.appLabel
        if (!prefs.readContent) {
            return s(R.string.say_sender_only, app, who)
        }
        val body = if (truncated) s(R.string.say_body_truncated, spokenBody) else spokenBody
        val group = message.conversationTitle
        return when {
            message.source == MessageSource.SMS || !prefs.announceApp ->
                if (group != null) s(R.string.say_intro_group_plain, group, who, body) else s(R.string.say_intro_plain, who, body)
            group != null -> s(R.string.say_intro_group, app, group, who, body)
            else -> s(R.string.say_intro_app, app, who, body)
        }
    }

    private fun spokenSender(): String {
        val name = message.senderName
        if (!name.isNullOrBlank()) return name
        val raw = message.sender
        return if (raw.any { it.isLetter() }) raw else contacts.speakableNumber(raw)
    }

    private fun canPrompt(): Boolean {
        if (!micAvailable || !prefs.voiceReplies || !listener.hasPermission() || !listener.isAvailable) return false
        return message.canReply || canCall() || truncated
    }

    private fun canCall() = prefs.allowCallBack && message.canCallBack

    private fun promptText(): String = when {
        message.canReply && canCall() -> s(R.string.say_prompt_call)
        message.canReply -> s(R.string.say_prompt)
        canCall() -> s(R.string.say_prompt_call_only)
        else -> s(R.string.say_prompt_more)
    }

    private fun afterAnnounce() {
        if (!canPrompt()) {
            finish(Outcome.DONE)
            return
        }
        listenForCommand()
    }

    // ---- command -------------------------------------------------------

    private fun listenForCommand() {
        listener.listen(Listener.Mode.COMMAND) { result ->
            if (!active) return@listen
            when (result) {
                is Listener.Result.Heard -> handleCommand(VoiceCommands.parseAfterMessage(result.alternatives), result)
                Listener.Result.NoSpeech, Listener.Result.Unavailable -> finish(Outcome.DONE)
                is Listener.Result.Failed ->
                    if (commandRetries++ < 1) listenForCommand() else finish(Outcome.DONE)
            }
        }
    }

    private fun handleCommand(parsed: ParsedCommand, heard: Listener.Result.Heard) {
        log.add("Heard: \"${heard.alternatives.first()}\" -> ${parsed.command}")
        when (parsed.command) {
            Command.STOP -> speaker.speak(s(R.string.say_stopped)) { finish(Outcome.STOPPED) }
            Command.SKIP -> finish(Outcome.DONE)
            Command.REPEAT -> announce()
            Command.READ_MORE -> {
                val rest = if (truncated) fullBody.removePrefix(spokenBody).trim() else ""
                val text = if (rest.isEmpty()) fullBody else rest
                truncated = false
                speaker.speak(text + " " + promptText()) { if (active) listenForCommand() }
            }
            Command.CALL -> when {
                !message.canCallBack -> speaker.speak(s(R.string.say_cant_call)) { if (active) listenForCommand() }
                !prefs.allowCallBack -> speaker.speak(s(R.string.say_call_disabled)) { if (active) listenForCommand() }
                else -> {
                    val ok = sender.callBack(message)
                    val text = if (ok) s(R.string.say_calling, spokenSender()) else s(R.string.say_call_failed)
                    speaker.speak(text) { finish(Outcome.DONE) }
                }
            }
            Command.REPLY -> when {
                !message.canReply -> speaker.speak(s(R.string.say_cant_reply)) { finish(Outcome.DONE) }
                parsed.inlineText != null -> gotDictation(parsed.inlineText)
                else -> askForDictation()
            }
            Command.SEND, Command.CANCEL, Command.CHANGE, Command.UNKNOWN ->
                if (commandRetries++ < 1) {
                    speaker.speak(s(R.string.say_help_command)) { if (active) listenForCommand() }
                } else {
                    finish(Outcome.DONE)
                }
        }
    }

    // ---- dictation -----------------------------------------------------

    private fun askForDictation() {
        speaker.speak(s(R.string.say_go_ahead)) { if (active) listenForDictation() }
    }

    private fun listenForDictation() {
        listener.listen(Listener.Mode.DICTATION) { result ->
            if (!active) return@listen
            when (result) {
                is Listener.Result.Heard -> gotDictation(result.alternatives.first())
                Listener.Result.NoSpeech, is Listener.Result.Failed ->
                    if (dictationRetries++ < 1) {
                        speaker.speak(s(R.string.say_didnt_catch)) { if (active) listenForDictation() }
                    } else {
                        speaker.speak(s(R.string.say_no_reply)) { finish(Outcome.DONE) }
                    }
                Listener.Result.Unavailable -> speaker.speak(s(R.string.say_no_reply)) { finish(Outcome.DONE) }
            }
        }
    }

    private fun gotDictation(text: String) {
        if (VoiceCommands.isCancelPhrase(text)) {
            cancelReply()
            return
        }
        draft = capitalise(text)
        log.add("Draft reply: \"$draft\"")
        if (prefs.confirmBeforeSend) confirm() else send()
    }

    // ---- confirmation --------------------------------------------------

    private fun confirm() {
        speaker.speak(s(R.string.say_confirm, draft)) { if (active) listenForConfirmation() }
    }

    private fun listenForConfirmation() {
        listener.listen(Listener.Mode.COMMAND) { result ->
            if (!active) return@listen
            when (result) {
                is Listener.Result.Heard -> {
                    val parsed = VoiceCommands.parseConfirmation(result.alternatives)
                    log.add("Heard: \"${result.alternatives.first()}\" -> ${parsed.command}")
                    when (parsed.command) {
                        Command.SEND -> send()
                        Command.CANCEL, Command.STOP -> cancelReply()
                        Command.CHANGE -> if (parsed.inlineText != null) gotDictation(parsed.inlineText) else askForDictation()
                        else -> retryConfirmation()
                    }
                }
                Listener.Result.NoSpeech, is Listener.Result.Failed -> retryConfirmation()
                Listener.Result.Unavailable -> cancelReply()
            }
        }
    }

    private fun retryConfirmation() {
        if (confirmRetries++ < 1) {
            speaker.speak(s(R.string.say_help_confirm)) { if (active) listenForConfirmation() }
        } else {
            cancelReply()
        }
    }

    private fun send() {
        val ok = if (message.source == MessageSource.TEST) true else sender.send(message, draft)
        val text = if (ok) s(R.string.say_sent) else s(R.string.say_send_failed)
        if (ok && message.source == MessageSource.TEST) log.add("Test reply (not sent): \"$draft\"")
        speaker.speak(text) { finish(Outcome.DONE) }
    }

    private fun cancelReply() {
        log.add("Reply cancelled")
        speaker.speak(s(R.string.say_cancelled)) { finish(Outcome.DONE) }
    }

    // ---- helpers -------------------------------------------------------

    private fun finish(outcome: Outcome) {
        if (!active) return
        active = false
        listener.cancel()
        val cb = onFinished
        onFinished = null
        cb?.invoke(outcome)
    }

    private fun capitalise(text: String): String =
        text.trim().replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

    private fun s(id: Int, vararg args: Any): String = context.getString(id, *args)
}
