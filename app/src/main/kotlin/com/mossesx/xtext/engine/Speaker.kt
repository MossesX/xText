package com.mossesx.xtext.engine

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Text-to-speech wrapper. All public methods are main-thread only; the
 * completion callback always runs on the main thread, exactly once, even if
 * the engine fails or never reports completion.
 */
class Speaker(private val context: Context, private val prefs: Prefs, private val log: ActivityLog) {

    private val main = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private val pendingInit = ArrayList<() -> Unit>()

    private var counter = 0
    private var currentId: String? = null
    private var currentDone: (() -> Unit)? = null
    private val watchdog = Runnable {
        log.add("Speech engine did not report completion; continuing")
        finishCurrent()
    }

    val isSpeaking: Boolean get() = currentId != null

    /** Starts engine initialisation early so the first message is not delayed. */
    fun warmUp() = ensureInit(null)

    fun speak(text: String, onDone: () -> Unit) {
        ensureInit {
            val engine = tts
            if (failed || engine == null) {
                onDone()
                return@ensureInit
            }
            cancelCurrent()
            engine.setSpeechRate(prefs.speechRate)
            engine.setPitch(prefs.speechPitch)
            val id = "xtext-${++counter}"
            currentId = id
            currentDone = onDone
            val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            if (result != TextToSpeech.SUCCESS) {
                log.add("Speech engine refused to speak (code $result)")
                finishCurrent()
                return@ensureInit
            }
            main.postDelayed(watchdog, estimateDurationMs(text))
        }
    }

    /** Stops speaking without invoking the pending completion callback. */
    fun stop() {
        cancelCurrent()
        pendingInit.clear()
        tts?.stop()
    }

    fun shutdown() {
        stop()
        tts?.shutdown()
        tts = null
        ready = false
        failed = false
    }

    private fun ensureInit(onReady: (() -> Unit)?) {
        if (ready || failed) {
            onReady?.invoke()
            return
        }
        if (onReady != null) pendingInit += onReady
        if (tts != null) return
        tts = TextToSpeech(context) { status -> main.post { onInit(status) } }
    }

    private fun onInit(status: Int) {
        val engine = tts
        if (status != TextToSpeech.SUCCESS || engine == null) {
            failed = true
            log.add("Text-to-speech engine is not available on this device")
        } else {
            engine.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            var lang = engine.setLanguage(Locale.getDefault())
            if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
                lang = engine.setLanguage(Locale.US)
            }
            if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
                log.add("No speech language data installed; speech may be silent")
            }
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit
                override fun onDone(utteranceId: String?) {
                    main.post { if (utteranceId == currentId) finishCurrent() }
                }

                @Suppress("OVERRIDE_DEPRECATION")
                override fun onError(utteranceId: String?) {
                    main.post { if (utteranceId == currentId) finishCurrent() }
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    main.post { if (utteranceId == currentId) finishCurrent() }
                }
                override fun onStop(utteranceId: String?, interrupted: Boolean) = Unit
            })
            ready = true
        }
        val callbacks = pendingInit.toList()
        pendingInit.clear()
        callbacks.forEach { it() }
    }

    private fun finishCurrent() {
        main.removeCallbacks(watchdog)
        val done = currentDone
        currentId = null
        currentDone = null
        done?.invoke()
    }

    private fun cancelCurrent() {
        main.removeCallbacks(watchdog)
        currentId = null
        currentDone = null
    }

    private fun estimateDurationMs(text: String): Long {
        val perChar = (70 / prefs.speechRate.coerceIn(0.5f, 3f)).toLong()
        return (text.length * perChar + 4000L).coerceAtMost(180_000L)
    }
}
