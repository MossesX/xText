package com.mossesx.xtext.engine

enum class Command {
    REPLY, REPEAT, SKIP, CALL, STOP, SEND, CANCEL, CHANGE, READ_MORE, UNKNOWN
}

data class ParsedCommand(val command: Command, val inlineText: String? = null)

/**
 * Maps what the speech recogniser heard to an action. The recogniser returns
 * several alternatives; the first alternative that maps to a known command wins.
 *
 * Phrases are English. They are kept in one place so another language can be
 * supported by replacing these tables.
 */
object VoiceCommands {

    private val STOP = setOf(
        "stop", "stop reading", "be quiet", "quiet", "shut up", "silence", "pause", "enough", "stop it",
    )
    private val SKIP = setOf(
        "ignore", "skip", "next", "no", "nope", "no thanks", "dismiss", "later", "not now", "nothing",
        "no reply", "don't reply", "ignore it", "skip it", "move on", "okay", "ok", "fine", "got it",
    )
    private val REPEAT = setOf(
        "repeat", "again", "say again", "say that again", "read again", "read it again", "what",
        "pardon", "repeat that", "one more time", "read that again",
    )
    private val CALL = setOf(
        "call", "call back", "call them", "call him", "call her", "ring", "ring back", "phone them",
        "call them back", "call him back", "call her back", "phone back",
    )
    private val READ_MORE = setOf("read more", "more", "continue", "full message", "read the rest", "rest")
    private val REPLY_PREFIXES = listOf(
        "reply saying", "reply with", "reply that", "reply", "respond with", "respond saying", "respond",
        "answer with", "answer saying", "answer", "say", "tell them", "tell him", "tell her", "text back",
        "text them", "write back", "write", "message back", "send",
    )
    private val SEND = setOf(
        "send", "send it", "yes", "yes send", "yes send it", "yep", "yeah", "yup", "ok", "okay", "sure",
        "correct", "go", "go ahead", "do it", "confirm", "that's right", "right", "fine", "good", "ok send",
        "okay send", "okay send it", "send message", "send the message", "yes please",
    )
    private val CANCEL = setOf(
        "cancel", "no", "nope", "don't", "don't send", "do not send", "never mind", "nevermind", "forget it",
        "abort", "discard", "delete", "stop", "no cancel", "cancel it", "scrap it", "drop it",
    )
    private val CHANGE = setOf(
        "change", "change it", "redo", "redo it", "again", "try again", "start over", "edit", "retry",
        "say again", "let me try again", "no change it", "different", "rewrite", "repeat",
    )

    /** Parses what was heard after a message was read out. */
    fun parseAfterMessage(alternatives: List<String>): ParsedCommand {
        for (alt in alternatives) {
            val t = normalise(alt)
            if (t.isEmpty()) continue
            when {
                t in STOP -> return ParsedCommand(Command.STOP)
                t in REPEAT -> return ParsedCommand(Command.REPEAT)
                t in CALL -> return ParsedCommand(Command.CALL)
                t in READ_MORE -> return ParsedCommand(Command.READ_MORE)
                t in SKIP -> return ParsedCommand(Command.SKIP)
            }
            val reply = parseReplyPrefix(t)
            if (reply != null) return reply
        }
        return ParsedCommand(Command.UNKNOWN)
    }

    /** Parses what was heard after "Send it?". */
    fun parseConfirmation(alternatives: List<String>): ParsedCommand {
        for (alt in alternatives) {
            val t = normalise(alt)
            if (t.isEmpty()) continue
            when {
                t in CHANGE -> return ParsedCommand(Command.CHANGE)
                t in CANCEL -> return ParsedCommand(Command.CANCEL)
                t in SEND -> return ParsedCommand(Command.SEND)
                t.startsWith("change to ") || t.startsWith("change it to ") || t.startsWith("make it ") -> {
                    val text = t.substringAfter(" to ").ifBlank { t.substringAfter("make it ") }
                    return ParsedCommand(Command.CHANGE, text.trim().takeIf { it.isNotEmpty() })
                }
            }
        }
        return ParsedCommand(Command.UNKNOWN)
    }

    /** "reply saying I'm on my way" -> REPLY with inline text "I'm on my way". */
    fun parseReplyPrefix(t: String): ParsedCommand? {
        for (prefix in REPLY_PREFIXES) {
            if (t == prefix) return ParsedCommand(Command.REPLY)
            if (t.startsWith("$prefix ")) {
                val rest = t.removePrefix(prefix).trim()
                return ParsedCommand(Command.REPLY, rest.takeIf { it.isNotEmpty() })
            }
        }
        return null
    }

    fun normalise(s: String): String =
        s.lowercase().trim().replace(Regex("""[.,!?]+$"""), "").replace(Regex("""\s+"""), " ")

    /** True if the dictated text itself is a cancel command rather than a reply. */
    fun isCancelPhrase(dictation: String): Boolean = normalise(dictation) in CANCEL
}
