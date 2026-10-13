package com.mossesx.xtext.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.mossesx.xtext.R
import com.mossesx.xtext.XTextApp
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.MessageSource
import com.mossesx.xtext.model.ReplyTarget
import com.mossesx.xtext.service.XTextService

/** Receives incoming SMS, stitches multipart messages together and hands them to the engine. */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val app = context.applicationContext as XTextApp
        if (!app.prefs.engineRequested || !app.prefs.readSms) return

        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (parts.isEmpty()) return

        // All parts of a multipart SMS share the originating address; concatenate their bodies.
        val byAddress = LinkedHashMap<String, StringBuilder>()
        var timestamp = 0L
        for (part in parts) {
            val p = part ?: continue
            val address = p.displayOriginatingAddress ?: p.originatingAddress ?: continue
            byAddress.getOrPut(address) { StringBuilder() }.append(p.displayMessageBody ?: p.messageBody ?: "")
            timestamp = maxOf(timestamp, p.timestampMillis)
        }
        // The subscription (SIM) the message arrived on, so a reply goes out on the same SIM.
        val subscriptionId = intent.getIntExtra("subscription", -1)

        for ((address, body) in byAddress) {
            val text = body.toString().trim()
            if (text.isEmpty()) continue
            val isPhoneNumber = address.any { it.isDigit() } && address.count { it.isLetter() } <= 1
            val message = IncomingMessage(
                id = timestamp,
                source = MessageSource.SMS,
                sender = address,
                senderName = null,
                body = text,
                appLabel = context.getString(R.string.label_sms),
                packageName = null,
                conversationTitle = null,
                timestamp = timestamp,
                replyTarget = ReplyTarget.Sms(address, subscriptionId),
                phoneNumber = if (isPhoneNumber) address else null,
            )
            XTextService.deliver(context, message)
        }
    }
}
