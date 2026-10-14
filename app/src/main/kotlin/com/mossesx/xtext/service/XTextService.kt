package com.mossesx.xtext.service

import android.app.ForegroundServiceStartNotAllowedException
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import com.mossesx.xtext.Notifications
import com.mossesx.xtext.R
import com.mossesx.xtext.XTextApp
import com.mossesx.xtext.engine.AudioRouter
import com.mossesx.xtext.engine.ContactResolver
import com.mossesx.xtext.engine.ConversationRunner
import com.mossesx.xtext.engine.Listener
import com.mossesx.xtext.engine.MessageSender
import com.mossesx.xtext.engine.ReadPolicy
import com.mossesx.xtext.engine.Speaker
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.MessageSource
import com.mossesx.xtext.model.ReplyTarget
import java.util.concurrent.Executors

/**
 * The always-on engine. Runs as a foreground service so that it may use the
 * microphone from the background, queues incoming messages and plays each one
 * through a [ConversationRunner].
 */
class XTextService : Service() {

    private val app get() = application as XTextApp
    private val prefs get() = app.prefs
    private val log get() = app.log

    private val main = Handler(Looper.getMainLooper())
    private val background = Executors.newSingleThreadExecutor()

    private lateinit var speaker: Speaker
    private lateinit var listener: Listener
    private lateinit var audio: AudioRouter
    private lateinit var sender: MessageSender
    private lateinit var contacts: ContactResolver
    private lateinit var policy: ReadPolicy
    private lateinit var runner: ConversationRunner

    private val queue = ArrayDeque<IncomingMessage>()
    private var sessionActive = false
    private var micActive = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var standbyWarned = false
    private var lastMessage: IncomingMessage? = null
    private var allowRestart = true

    /** Bodies read recently, used to avoid reading an SMS twice (broadcast + SMS app notification). */
    private val recentBodies = ArrayDeque<Pair<String, Long>>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        speaker = Speaker(this, prefs, log)
        listener = Listener(this, prefs, log)
        audio = AudioRouter(this, log)
        sender = MessageSender(this, log)
        contacts = ContactResolver(this)
        policy = ReadPolicy(this, prefs, audio)
        runner = ConversationRunner(this, prefs, log, speaker, listener, sender, contacts)
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        when (action) {
            ACTION_STOP -> {
                prefs.engineRequested = false
                allowRestart = false
                goForeground(withMic = false)
                log.add("Engine stopped")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START, ACTION_START_STANDBY -> {
                val wantMic = action == ACTION_START
                prefs.engineRequested = true
                if (!goForeground(withMic = wantMic)) return START_NOT_STICKY
                speaker.warmUp()
                if (wantMic) standbyWarned = false
                log.add(if (micActive) "Engine running with voice replies" else "Engine running (voice replies need a tap on the notification)")
            }
            ACTION_PAUSE -> {
                if (!goForeground(withMic = micActive)) return START_NOT_STICKY
                prefs.pausedUntil = System.currentTimeMillis() + PAUSE_MS
                runner.abort()
                endSession()
                queue.clear()
                log.add("Paused for 30 minutes")
            }
            ACTION_RESUME -> {
                if (!goForeground(withMic = true)) return START_NOT_STICKY
                prefs.pausedUntil = 0L
                log.add("Resumed")
            }
            ACTION_REPLY_LAST -> {
                if (!goForeground(withMic = true)) return START_NOT_STICKY
                val last = lastMessage
                if (last != null) {
                    runner.abort()
                    endSession()
                    queue.addFirst(last)
                    processNext()
                }
            }
            ACTION_TEST -> {
                if (!goForeground(withMic = micActive || listener.hasPermission())) return START_NOT_STICKY
                enqueue(sampleMessage())
            }
            ACTION_DELIVER -> {
                @Suppress("DEPRECATION")
                val msg = intent?.getSerializableExtra(IncomingMessage.EXTRA_KEY) as? IncomingMessage
                if (!goForeground(withMic = micActive)) {
                    if (msg != null) showMissed(this, msg)
                    return START_NOT_STICKY
                }
                if (msg != null) enqueue(msg)
            }
        }
        updateNotification()
        return START_STICKY
    }

    override fun onDestroy() {
        runner.abort()
        endSession()
        listener.destroy()
        speaker.shutdown()
        background.shutdown()
        if (instance === this) instance = null
        super.onDestroy()
        if (allowRestart && prefs.engineRequested) {
            // Android stopped us (memory pressure or a task swipe); come back in standby.
            runCatching {
                startForegroundService(Intent(this, XTextService::class.java).setAction(ACTION_START_STANDBY))
            }
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        updateNotification()
    }

    // ---- lifecycle helpers ---------------------------------------------

    /**
     * Promotes the service to the foreground. Tries with microphone access
     * first (when asked and permitted) and falls back to read-only mode, since
     * Android only allows the microphone type when the start came from the
     * user (the app, or a tap on the notification). Returns false, and stops
     * the service, when Android refuses the foreground start altogether.
     */
    private fun goForeground(withMic: Boolean): Boolean {
        val micPermitted = withMic &&
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (micPermitted && tryStartForeground(mic = true)) {
            setMicActive(true)
            return true
        }
        if (micPermitted) log.add("Microphone not allowed for a background start; running in read-only mode")
        if (tryStartForeground(mic = false)) {
            setMicActive(false)
            return true
        }
        log.add("Android did not allow the engine to start from the background")
        allowRestart = false
        stopSelf()
        return false
    }

    private fun tryStartForeground(mic: Boolean): Boolean {
        val notification = Notifications.buildServiceNotification(
            this, statusText(mic), mic, prefs.isPaused, lastMessage != null,
        )
        return runCatching {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> {
                    val type = if (mic) {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    } else {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    }
                    startForeground(Notifications.ID_SERVICE, notification, type)
                }
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && mic ->
                    startForeground(Notifications.ID_SERVICE, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
                else -> startForeground(Notifications.ID_SERVICE, notification)
            }
        }.onFailure { e ->
            val notAllowed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && e is ForegroundServiceStartNotAllowedException
            if (!notAllowed) log.add("startForeground(mic=$mic) failed: ${e.javaClass.simpleName}: ${e.message}")
        }.isSuccess
    }

    private fun setMicActive(value: Boolean) {
        micActive = value
        runner.micAvailable = value
    }

    private fun statusText(mic: Boolean): String = when {
        prefs.isPaused -> getString(R.string.status_paused)
        sessionActive -> getString(R.string.status_reading)
        mic -> getString(R.string.status_listening)
        else -> getString(R.string.status_standby)
    }

    private fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(
            Notifications.ID_SERVICE,
            Notifications.buildServiceNotification(
                this, statusText(micActive), micActive, prefs.isPaused, lastMessage != null,
            ),
        )
        listeners.toList().forEach { it() }
    }

    // ---- queue -----------------------------------------------------------

    private fun enqueue(message: IncomingMessage) {
        if (isDuplicate(message)) {
            log.add("Skipped duplicate of a message already read")
            return
        }
        when (val decision = policy.evaluate(message)) {
            is ReadPolicy.Decision.Skip -> {
                log.add("Not reading message from ${message.displayName}: ${decision.reason}")
                return
            }
            ReadPolicy.Decision.Read -> Unit
        }
        queue.addLast(message)
        if (!sessionActive) processNext()
    }

    private fun isDuplicate(message: IncomingMessage): Boolean {
        val now = System.currentTimeMillis()
        while (recentBodies.isNotEmpty() && now - recentBodies.first().second > DUPLICATE_WINDOW_MS) {
            recentBodies.removeFirst()
        }
        val key = message.body.trim()
        if (message.source == MessageSource.NOTIFICATION && recentBodies.any { it.first == key }) return true
        if (message.source == MessageSource.SMS) recentBodies.addLast(key to now)
        return false
    }

    private fun processNext() {
        if (runner.isActive) return
        val next = queue.removeFirstOrNull()
        if (next == null) {
            endSession()
            updateNotification()
            return
        }
        beginSession()
        // Resolve the contact off the main thread, then play the message.
        background.execute {
            val resolved = resolveContact(next)
            main.post {
                if (instance !== this) return@post
                lastMessage = resolved
                log.add("Reading ${resolved.appLabel} message from ${resolved.displayName}")
                updateNotification()
                runner.run(resolved) { outcome ->
                    if (outcome == ConversationRunner.Outcome.STOPPED) {
                        queue.clear()
                        log.add("Stopped by voice command")
                    }
                    processNext()
                }
            }
        }
    }

    private fun resolveContact(message: IncomingMessage): IncomingMessage {
        if (!prefs.useContactNames || message.senderName != null) return message
        val number = message.phoneNumber ?: return message
        val name = contacts.lookup(number) ?: return message
        return message.copy(senderName = name)
    }

    private fun beginSession() {
        if (sessionActive) return
        sessionActive = true
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "xtext:session").also {
            it.acquire(SESSION_WAKELOCK_MS)
        }
        audio.requestFocus()
        if (micActive && prefs.useBluetoothMic) audio.startVoiceRoute()
        if (!micActive && prefs.voiceReplies && !standbyWarned) {
            standbyWarned = true
            log.add("Voice replies are off until the engine is started from the app or its notification")
        }
    }

    private fun endSession() {
        if (!sessionActive) return
        sessionActive = false
        audio.stopVoiceRoute()
        audio.abandonFocus()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun sampleMessage(): IncomingMessage = IncomingMessage(
        id = System.currentTimeMillis(),
        source = MessageSource.TEST,
        sender = getString(R.string.test_sender),
        senderName = null,
        body = getString(R.string.test_body),
        appLabel = getString(R.string.label_sms),
        packageName = null,
        conversationTitle = null,
        timestamp = System.currentTimeMillis(),
        replyTarget = ReplyTarget.Sms("+15550100"),
        phoneNumber = null,
    )

    companion object {
        const val ACTION_START = "com.mossesx.xtext.action.START"
        const val ACTION_START_STANDBY = "com.mossesx.xtext.action.START_STANDBY"
        const val ACTION_STOP = "com.mossesx.xtext.action.STOP"
        const val ACTION_PAUSE = "com.mossesx.xtext.action.PAUSE"
        const val ACTION_RESUME = "com.mossesx.xtext.action.RESUME"
        const val ACTION_REPLY_LAST = "com.mossesx.xtext.action.REPLY_LAST"
        const val ACTION_TEST = "com.mossesx.xtext.action.TEST"
        const val ACTION_DELIVER = "com.mossesx.xtext.action.DELIVER"

        private const val PAUSE_MS = 30L * 60 * 1000
        private const val SESSION_WAKELOCK_MS = 5L * 60 * 1000
        private const val DUPLICATE_WINDOW_MS = 45_000L

        @Volatile
        var instance: XTextService? = null
            private set

        val isRunning: Boolean get() = instance != null
        val isMicActive: Boolean get() = instance?.micActive == true

        /** Observers notified on the main thread whenever the service state changes. */
        val listeners = mutableSetOf<() -> Unit>()

        fun start(context: Context, withMic: Boolean = true) {
            val intent = Intent(context, XTextService::class.java)
                .setAction(if (withMic) ACTION_START else ACTION_START_STANDBY)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.startForegroundService(Intent(context, XTextService::class.java).setAction(ACTION_STOP))
        }

        fun send(context: Context, action: String) {
            context.startForegroundService(Intent(context, XTextService::class.java).setAction(action))
        }

        /**
         * Hands a message to the engine. If the engine is not running it is
         * started in standby; when Android forbids that, a tappable
         * notification is shown instead so nothing is lost silently.
         */
        fun deliver(context: Context, message: IncomingMessage) {
            val running = instance
            if (running != null) {
                Handler(Looper.getMainLooper()).post { running.enqueue(message) }
                return
            }
            val app = context.applicationContext as XTextApp
            if (!app.prefs.engineRequested) return
            val intent = Intent(context, XTextService::class.java)
                .setAction(ACTION_DELIVER)
                .putExtra(IncomingMessage.EXTRA_KEY, message)
            val started = runCatching { context.startForegroundService(intent) }.isSuccess
            if (!started) showMissed(context, message)
        }

        private fun showMissed(context: Context, message: IncomingMessage) {
            val app = context.applicationContext as XTextApp
            app.log.add("Could not start engine for a message from ${message.displayName}")
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.notify(
                Notifications.ID_ALERT,
                Notifications.buildMissedNotification(
                    context,
                    context.getString(R.string.missed_title, message.displayName),
                    context.getString(R.string.missed_text),
                ),
            )
        }
    }
}
