package com.mossesx.xtext.engine

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build

/** Audio focus, Bluetooth headset microphone routing and environment checks. */
class AudioRouter(private val context: Context, private val log: ActivityLog) {

    private val am = context.getSystemService(AudioManager::class.java)
    private var focusRequest: AudioFocusRequest? = null
    private var routeActive = false

    fun requestFocus(): Boolean {
        if (focusRequest != null) return true
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setWillPauseWhenDucked(false)
            .setOnAudioFocusChangeListener { }
            .build()
        val granted = am.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        if (granted) focusRequest = request
        return granted
    }

    fun abandonFocus() {
        focusRequest?.let { am.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    /** Routes the microphone to a connected Bluetooth headset / car kit when one is available. */
    @Suppress("DEPRECATION")
    fun startVoiceRoute() {
        if (routeActive) return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val sco = am.availableCommunicationDevices
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
                if (sco != null && am.setCommunicationDevice(sco)) routeActive = true
            } else if (am.isBluetoothScoAvailableOffCall) {
                val hasSco = am.getDevices(AudioManager.GET_DEVICES_INPUTS)
                    .any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
                if (hasSco) {
                    am.startBluetoothSco()
                    am.isBluetoothScoOn = true
                    routeActive = true
                }
            }
        }.onFailure { log.add("Bluetooth microphone routing failed: ${it.message}") }
    }

    @Suppress("DEPRECATION")
    fun stopVoiceRoute() {
        if (!routeActive) return
        routeActive = false
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice()
            } else {
                am.isBluetoothScoOn = false
                am.stopBluetoothSco()
            }
        }
    }

    fun isHeadsetOrCarConnected(): Boolean {
        val headset = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
            when (it.type) {
                AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                AudioDeviceInfo.TYPE_WIRED_HEADSET,
                AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                AudioDeviceInfo.TYPE_USB_HEADSET,
                AudioDeviceInfo.TYPE_HEARING_AID,
                -> true
                else -> false
            }
        }
        if (headset) return true
        val ui = context.getSystemService(UiModeManager::class.java)
        return ui?.currentModeType == Configuration.UI_MODE_TYPE_CAR
    }

    fun isInCall(): Boolean =
        am.mode == AudioManager.MODE_IN_CALL || am.mode == AudioManager.MODE_IN_COMMUNICATION
}
