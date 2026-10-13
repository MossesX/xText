package com.mossesx.xtext.service

import android.app.Notification
import android.app.NotificationManager
import android.app.RemoteInput
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.provider.Settings
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.mossesx.xtext.XTextApp
import com.mossesx.xtext.model.IncomingMessage
import com.mossesx.xtext.model.MessageSource
import com.mossesx.xtext.model.NotificationReplyRegistry
import com.mossesx.xtext.model.ReplyTarget

/**
 * Turns notifications from messaging apps (WhatsApp, Telegram, Signal, RCS in
 * Google Messages, ...) into [IncomingMessage]s, keeping the app's own "Reply"
 * action so a spoken reply can go back through the same app.
 */
class MessageNotificationListener : NotificationListenerService() {

    private val app get() = application as XTextApp

    /** Keys of notifications already handled, to ignore re-posts of the same message. */
    private val seen = object : LinkedHashMap<String, Long>(64, 0.75f, false) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>?) = size > 300
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val prefs = app.prefs
        if (!prefs.engineRequested || !prefs.readNotifications) return
        val pkg = sbn.packageName
        if (pkg == packageName || pkg !in prefs.watchedPackages) return
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (sbn.isOngoing) return
        if (n.flags and Notification.FLAG_FOREGROUND_SERVICE != 0) return

        val extracted = extract(n) ?: return
        if (extracted.text.isBlank()) return
        if (extracted.sender.isBlank()) return

        val key = "$pkg|${sbn.key}|${extracted.sender}|${extracted.text}|${extracted.time}"
        synchronized(seen) {
            if (seen.containsKey(key)) return
            seen[key] = System.currentTimeMillis()
        }
        // Old notifications re-delivered when the listener (re)connects are not new messages.
        if (System.currentTimeMillis() - sbn.postTime > MAX_AGE_MS) return

        val replyTarget = findReplyAction(n, pkg)
        val message = IncomingMessage(
            id = sbn.postTime,
            source = MessageSource.NOTIFICATION,
            sender = extracted.sender,
            senderName = null,
            body = extracted.text,
            appLabel = appLabel(pkg),
            packageName = pkg,
            conversationTitle = extracted.conversationTitle,
            timestamp = sbn.postTime,
            replyTarget = replyTarget,
            phoneNumber = null,
        )
        XTextService.deliver(this, message)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) = Unit

    override fun onListenerConnected() {
        app.log.add("Notification access connected")
    }

    private data class Extracted(val sender: String, val text: String, val time: Long, val conversationTitle: String?)

    private fun extract(n: Notification): Extracted? {
        val extras = n.extras ?: return null
        val conversationTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()
            ?.takeIf { it.isNotBlank() }

        // Preferred: MessagingStyle, which carries each message with its sender.
        val messages = messagingStyleMessages(extras)
        if (messages.isNotEmpty()) {
            val isGroup = extras.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false) || conversationTitle != null
            val last = messages.last()
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            val sender = last.sender ?: title ?: return null
            return Extracted(sender, last.text, last.time, if (isGroup) conversationTitle ?: title else null)
        }

        // Fallback: plain title/text.
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: return null
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()?.trim() ?: return null
        if (looksLikeSummary(title, text)) return null
        // Many apps format group messages as "Group: Sender" or "Sender @ Group".
        val sender = title.substringAfterLast(": ").trim().ifEmpty { title }
        val group = if (title.contains(": ")) title.substringBeforeLast(": ").trim() else conversationTitle
        return Extracted(sender, text, n.`when`, group)
    }

    private data class StyledMessage(val text: String, val time: Long, val sender: String?)

    @Suppress("DEPRECATION")
    private fun messagingStyleMessages(extras: Bundle): List<StyledMessage> {
        val array: Array<Parcelable>? = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        if (array.isNullOrEmpty()) return emptyList()
        val out = ArrayList<StyledMessage>(array.size)
        for (p in array) {
            val b = p as? Bundle ?: continue
            val text = b.getCharSequence("text")?.toString()?.trim() ?: continue
            if (text.isEmpty()) continue
            val time = b.getLong("time", 0L)
            val person: android.app.Person? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                b.getParcelable("sender_person")
            } else {
                null
            }
            val sender = person?.name?.toString()?.takeIf { it.isNotBlank() }
                ?: b.getCharSequence("sender")?.toString()?.takeIf { it.isNotBlank() }
            out += StyledMessage(text, time, sender)
        }
        return out
    }

    /** "3 new messages", "2 chats" etc. are summaries, not messages. */
    private fun looksLikeSummary(title: String, text: String): Boolean {
        val t = text.lowercase()
        return Regex("""^\d+ (new )?(messages?|chats?|notifications?)""").containsMatchIn(t) ||
            t.startsWith("checking for new messages") ||
            title.equals("WhatsApp", true) && Regex("""\d+ messages? from \d+ chats?""").containsMatchIn(t)
    }

    private fun findReplyAction(n: Notification, pkg: String): ReplyTarget {
        val actions = n.actions ?: return ReplyTarget.None
        var best: Pair<Notification.Action, RemoteInput>? = null
        for (action in actions) {
            val inputs = action.remoteInputs ?: continue
            val input = inputs.firstOrNull { it.allowFreeFormInput } ?: continue
            val isReply = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
                action.semanticAction == Notification.Action.SEMANTIC_ACTION_REPLY
            if (isReply) {
                best = action to input
                break
            }
            if (best == null) best = action to input
        }
        val (action, input) = best ?: return ReplyTarget.None
        val id = NotificationReplyRegistry.register(action, input, pkg)
        return ReplyTarget.NotificationReply(id)
    }

    private fun appLabel(pkg: String): String =
        runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }
            .getOrNull() ?: com.mossesx.xtext.engine.Prefs.KNOWN_APPS[pkg] ?: pkg

    companion object {
        private const val MAX_AGE_MS = 2 * 60 * 1000L

        fun isEnabled(context: Context): Boolean {
            val cn = ComponentName(context, MessageNotificationListener::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                val nm = context.getSystemService(NotificationManager::class.java)
                return nm.isNotificationListenerAccessGranted(cn)
            }
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
            return flat.split(':').any { ComponentName.unflattenFromString(it) == cn }
        }

        /** The package that will also raise a notification for every SMS we already read via broadcast. */
        fun defaultSmsPackage(context: Context): String? = Telephony.Sms.getDefaultSmsPackage(context)
    }
}
