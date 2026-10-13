package com.mossesx.xtext.engine

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.telephony.SmsManager
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.NotificationReplyRegistry
import com.mossesx.xtext.model.ReplyTarget
import com.mossesx.xtext.receiver.SmsSentReceiver

/** Delivers spoken replies: as an SMS, or through the originating app's notification reply action. */
class MessageSender(private val context: Context, private val log: ActivityLog) {

    fun send(message: IncomingMessage, text: String): Boolean = when (val target = message.replyTarget) {
        is ReplyTarget.Sms -> sendSms(target, text)
        is ReplyTarget.NotificationReply -> sendNotificationReply(target, text)
        ReplyTarget.None -> false
    }

    @Suppress("DEPRECATION")
    private fun sendSms(target: ReplyTarget.Sms, text: String): Boolean {
        if (context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            log.add("Cannot send SMS: permission not granted")
            return false
        }
        return runCatching {
            val base = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                SmsManager.getDefault()
            }
            val manager = if (target.subscriptionId >= 0) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    base.createForSubscriptionId(target.subscriptionId)
                } else {
                    SmsManager.getSmsManagerForSubscriptionId(target.subscriptionId)
                }
            } else {
                base
            }
            val parts = manager.divideMessage(text)
            val sentIntents = ArrayList<PendingIntent>(parts.size)
            for (i in parts.indices) {
                val intent = Intent(context, SmsSentReceiver::class.java)
                    .setAction(SmsSentReceiver.ACTION_SENT)
                    .putExtra(SmsSentReceiver.EXTRA_ADDRESS, target.address)
                    .putExtra(SmsSentReceiver.EXTRA_PART, i)
                sentIntents += PendingIntent.getBroadcast(
                    context,
                    (System.nanoTime() and 0x7fffffff).toInt() + i,
                    intent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
                )
            }
            manager.sendMultipartTextMessage(target.address, null, parts, sentIntents, null)
            log.add("SMS reply sent to ${target.address}")
            true
        }.onFailure { log.add("SMS send failed: ${it.message}") }.getOrDefault(false)
    }

    private fun sendNotificationReply(target: ReplyTarget.NotificationReply, text: String): Boolean {
        val pending = NotificationReplyRegistry.get(target.replyId)
        if (pending == null) {
            log.add("Reply action has expired")
            return false
        }
        return runCatching {
            val intent = Intent()
            val results = Bundle().apply { putCharSequence(pending.remoteInput.resultKey, text) }
            android.app.RemoteInput.addResultsToIntent(arrayOf(pending.remoteInput), intent, results)
            pending.action.actionIntent.send(context, 0, intent)
            log.add("Reply sent through ${pending.packageName}")
            true
        }.onFailure { log.add("Notification reply failed: ${it.message}") }.getOrDefault(false)
    }

    /** Places a call to the sender. Requires CALL_PHONE. */
    fun callBack(message: IncomingMessage): Boolean {
        val number = message.phoneNumber ?: return false
        if (context.checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            log.add("Cannot call: phone permission not granted")
            return false
        }
        val uri = Uri.fromParts("tel", number, null)
        return runCatching {
            val telecom = context.getSystemService(TelecomManager::class.java)
            if (telecom != null) {
                telecom.placeCall(uri, Bundle())
            } else {
                context.startActivity(Intent(Intent.ACTION_CALL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            log.add("Calling $number")
            true
        }.onFailure { log.add("Call failed: ${it.message}") }.getOrDefault(false)
    }
}
