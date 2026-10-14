package com.mossesx.xtext.engine

import android.content.Context
import android.os.PowerManager
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.MessageSource

/** Decides whether a message should be read aloud right now. */
class ReadPolicy(
    private val context: Context,
    private val prefs: Prefs,
    private val audio: AudioRouter,
) {

    sealed class Decision {
        object Read : Decision()
        data class Skip(val reason: String) : Decision()
    }

    fun evaluate(message: IncomingMessage): Decision {
        if (message.source == MessageSource.TEST) return Decision.Read
        if (prefs.isPaused) return Decision.Skip("paused")
        if (QuietHours.isQuietNow(prefs)) return Decision.Skip("quiet hours")
        if (audio.isInCall()) return Decision.Skip("in a call")
        when (prefs.readMode) {
            ReadMode.ALWAYS -> Unit
            ReadMode.SCREEN_OFF -> {
                val pm = context.getSystemService(PowerManager::class.java)
                if (pm.isInteractive) return Decision.Skip("screen is on")
            }
            ReadMode.HEADSET_OR_CAR -> {
                if (!audio.isHeadsetOrCarConnected()) return Decision.Skip("no headset or car connected")
            }
        }
        if (isBlocked(message)) return Decision.Skip("sender is blocked")
        if (prefs.contactsOnly && message.source == MessageSource.SMS && message.senderName == null) {
            return Decision.Skip("sender is not a contact")
        }
        return Decision.Read
    }

    private fun isBlocked(message: IncomingMessage): Boolean {
        val blocked = prefs.blockedSenders
        if (blocked.isEmpty()) return false
        val candidates = listOfNotNull(message.sender, message.senderName, message.phoneNumber)
            .map { it.lowercase() }
        return blocked.any { b ->
            val needle = b.lowercase().trim()
            needle.isNotEmpty() && candidates.any { it.contains(needle) }
        }
    }
}
