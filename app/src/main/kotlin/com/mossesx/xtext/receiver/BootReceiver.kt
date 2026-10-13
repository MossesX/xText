package com.mossesx.xtext.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.mossesx.xtext.XTextApp
import com.mossesx.xtext.service.XTextService

/** Brings the engine back after a reboot or an app update, in standby until the user taps "Enable voice". */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val app = context.applicationContext as XTextApp
        if (!app.prefs.engineRequested) return
        runCatching { XTextService.start(context, withMic = false) }
            .onFailure { app.log.add("Could not restart engine after boot: ${it.message}") }
    }
}
