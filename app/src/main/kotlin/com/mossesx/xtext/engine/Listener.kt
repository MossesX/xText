package com.mossesx.xtext.engine

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Speech-to-text wrapper around [SpeechRecognizer]. Main-thread only; the
 * result callback runs on the main thread exactly once per [listen] call.
 */
class Listener(private val context: Context, private val prefs: Prefs, private val log: ActivityLog) {

    sealed class Result {
        data class Heard(val alternatives: List<String>) : Result()
        object NoSpeech : Result()
        data class Failed(val code: Int) : Result()
        object Unavailable : Result()
    }

    enum class Mode { COMMAND, DICTATION }

    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var recognizerOnDevice = false
    private var callback: ((Result) -> Unit)? = null
    private val watchdog = Runnable {
        log.add("Listening timed out")
        recognizer?.cancel()
        deliver(Result.NoSpeech)
    }

    val isListening: Boolean get() = callback != null

    val isAvailable: Boolean get() = SpeechRecognizer.isRecognitionAvailable(context)

    fun hasPermission(): Boolean =
        context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    fun listen(mode: Mode, onResult: (Result) -> Unit) {
        if (!hasPermission() || !isAvailable) {
            onResult(Result.Unavailable)
            return
        }
        cancel()
        val r = obtainRecognizer()
        if (r == null) {
            onResult(Result.Unavailable)
            return
        }
        callback = onResult
        val silenceMs = if (mode == Mode.COMMAND) 1200L else 2000L
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, silenceMs)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, silenceMs)
            if (prefs.preferOnDeviceRecognition && !recognizerOnDevice) {
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }
        }
        val timeout = if (mode == Mode.COMMAND) prefs.commandTimeoutMs else prefs.dictationTimeoutMs
        main.postDelayed(watchdog, timeout.toLong() + 3000L)
        runCatching { r.startListening(intent) }.onFailure {
            log.add("Could not start listening: ${it.message}")
            destroyRecognizer()
            deliver(Result.Failed(SpeechRecognizer.ERROR_CLIENT))
        }
    }

    /** Stops listening without invoking the pending callback. */
    fun cancel() {
        main.removeCallbacks(watchdog)
        callback = null
        runCatching { recognizer?.cancel() }
    }

    fun destroy() {
        cancel()
        destroyRecognizer()
    }

    private fun obtainRecognizer(): SpeechRecognizer? {
        recognizer?.let { return it }
        val created = runCatching {
            if (prefs.preferOnDeviceRecognition &&
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
            ) {
                recognizerOnDevice = true
                SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
            } else {
                recognizerOnDevice = false
                SpeechRecognizer.createSpeechRecognizer(context)
            }
        }.getOrElse {
            log.add("Speech recogniser could not be created: ${it.message}")
            return null
        }
        created.setRecognitionListener(recognitionListener)
        recognizer = created
        return created
    }

    private fun destroyRecognizer() {
        runCatching { recognizer?.destroy() }
        recognizer = null
    }

    private fun deliver(result: Result) {
        main.removeCallbacks(watchdog)
        val cb = callback ?: return
        callback = null
        cb(result)
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onPartialResults(partialResults: Bundle?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onResults(results: Bundle?) {
            val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                .orEmpty()
            deliver(if (list.isEmpty()) Result.NoSpeech else Result.Heard(list))
        }

        override fun onError(error: Int) {
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                -> deliver(Result.NoSpeech)

                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                    log.add("Microphone permission is missing")
                    deliver(Result.Unavailable)
                }

                SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                SpeechRecognizer.ERROR_CLIENT,
                SpeechRecognizer.ERROR_SERVER,
                -> {
                    // The recogniser is in a bad state; a fresh instance recovers it.
                    destroyRecognizer()
                    deliver(Result.Failed(error))
                }

                else -> {
                    log.add("Speech recognition error $error")
                    deliver(Result.Failed(error))
                }
            }
        }
    }
}
