package com.mossesx.xtext.engine

import android.content.Context
import android.content.SharedPreferences

enum class ReadMode { ALWAYS, SCREEN_OFF, HEADSET_OR_CAR }

/** All user settings. Backed by SharedPreferences; cheap to read from any thread. */
class Prefs(context: Context) {

    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("xtext", Context.MODE_PRIVATE)

    // ---- master ----
    /** The user wants the engine running (survives reboots). */
    var engineRequested: Boolean by bool("engine_requested", false)

    var pausedUntil: Long by long("paused_until", 0L)

    val isPaused: Boolean get() = pausedUntil > System.currentTimeMillis()

    // ---- what to read ----
    var readSms: Boolean by bool("read_sms", true)
    var readNotifications: Boolean by bool("read_notifications", true)
    var readContent: Boolean by bool("read_content", true)
    var useContactNames: Boolean by bool("use_contact_names", true)
    var contactsOnly: Boolean by bool("contacts_only", false)
    var announceApp: Boolean by bool("announce_app", true)
    var readMode: ReadMode
        get() = runCatching { ReadMode.valueOf(sp.getString("read_mode", null) ?: "") }
            .getOrDefault(ReadMode.ALWAYS)
        set(value) = sp.edit().putString("read_mode", value.name).apply()
    var maxChars: Int by int("max_chars", 400)

    // ---- quiet hours (minutes since midnight) ----
    var quietHoursEnabled: Boolean by bool("quiet_enabled", false)
    var quietStart: Int by int("quiet_start", 22 * 60)
    var quietEnd: Int by int("quiet_end", 7 * 60)

    // ---- voice ----
    var speechRate: Float by float("speech_rate", 1.0f)
    var speechPitch: Float by float("speech_pitch", 1.0f)
    var voiceReplies: Boolean by bool("voice_replies", true)
    var confirmBeforeSend: Boolean by bool("confirm_before_send", true)
    var preferOnDeviceRecognition: Boolean by bool("prefer_on_device", true)
    var useBluetoothMic: Boolean by bool("bluetooth_mic", true)
    var allowCallBack: Boolean by bool("allow_call_back", false)
    var commandTimeoutMs: Int by int("command_timeout_ms", 6000)
    var dictationTimeoutMs: Int by int("dictation_timeout_ms", 15000)

    // ---- apps and senders ----
    var watchedPackages: Set<String>
        get() = sp.getStringSet("watched_packages", null) ?: DEFAULT_WATCHED
        set(value) = sp.edit().putStringSet("watched_packages", value.toSet()).apply()

    var blockedSenders: Set<String>
        get() = sp.getStringSet("blocked_senders", null) ?: emptySet()
        set(value) = sp.edit().putStringSet("blocked_senders", value.toSet()).apply()

    fun registerListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
        sp.registerOnSharedPreferenceChangeListener(l)

    fun unregisterListener(l: SharedPreferences.OnSharedPreferenceChangeListener) =
        sp.unregisterOnSharedPreferenceChangeListener(l)

    // ---- delegates ----
    private fun bool(key: String, def: Boolean) = object : kotlin.properties.ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = sp.getBoolean(key, def)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Boolean) =
            sp.edit().putBoolean(key, value).apply()
    }

    private fun int(key: String, def: Int) = object : kotlin.properties.ReadWriteProperty<Any?, Int> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = sp.getInt(key, def)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Int) =
            sp.edit().putInt(key, value).apply()
    }

    private fun long(key: String, def: Long) = object : kotlin.properties.ReadWriteProperty<Any?, Long> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = sp.getLong(key, def)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Long) =
            sp.edit().putLong(key, value).apply()
    }

    private fun float(key: String, def: Float) = object : kotlin.properties.ReadWriteProperty<Any?, Float> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = sp.getFloat(key, def)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: Float) =
            sp.edit().putFloat(key, value).apply()
    }

    companion object {
        /** Messaging apps whose notifications are read by default (when installed). */
        val DEFAULT_WATCHED: Set<String> = setOf(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "org.telegram.messenger",
            "org.thoughtcrime.securesms",
            "com.facebook.orca",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.viber.voip",
            "jp.naver.line.android",
            "com.microsoft.teams",
            "com.Slack",
            "com.discord",
            "com.instagram.android",
            "com.skype.raider",
        )

        /** Known messaging apps offered in the settings screen, with a fallback label. */
        val KNOWN_APPS: Map<String, String> = linkedMapOf(
            "com.google.android.apps.messaging" to "Google Messages (RCS)",
            "com.samsung.android.messaging" to "Samsung Messages",
            "com.whatsapp" to "WhatsApp",
            "com.whatsapp.w4b" to "WhatsApp Business",
            "org.telegram.messenger" to "Telegram",
            "org.thoughtcrime.securesms" to "Signal",
            "com.facebook.orca" to "Messenger",
            "com.instagram.android" to "Instagram",
            "com.viber.voip" to "Viber",
            "jp.naver.line.android" to "LINE",
            "com.microsoft.teams" to "Microsoft Teams",
            "com.Slack" to "Slack",
            "com.discord" to "Discord",
            "com.skype.raider" to "Skype",
            "com.snapchat.android" to "Snapchat",
        )
    }
}
