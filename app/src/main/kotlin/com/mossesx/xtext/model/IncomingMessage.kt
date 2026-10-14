package com.mossesx.xtext.model

import java.io.Serializable

enum class MessageSource { SMS, NOTIFICATION, TEST }

/** Where a spoken reply should go. */
sealed class ReplyTarget : Serializable {
    /** Reply with an SMS to this address, optionally on a specific SIM. */
    data class Sms(val address: String, val subscriptionId: Int = -1) : ReplyTarget()

    /** Reply through a notification "reply" action registered in [NotificationReplyRegistry]. */
    data class NotificationReply(val replyId: String) : ReplyTarget()

    /** The message cannot be replied to (for example a one-way service message). */
    object None : ReplyTarget() {
        private fun readResolve(): Any = None
    }
}

data class IncomingMessage(
    val id: Long,
    val source: MessageSource,
    /** Raw sender: a phone number for SMS, or the name shown by the messaging app. */
    val sender: String,
    /** Resolved contact name, when available. */
    val senderName: String?,
    val body: String,
    /** Human readable source: "SMS", "WhatsApp", ... */
    val appLabel: String,
    val packageName: String?,
    /** Group / conversation title for group chats, if any. */
    val conversationTitle: String?,
    val timestamp: Long,
    val replyTarget: ReplyTarget,
    /** A phone number that can be called back, if known. */
    val phoneNumber: String?,
) : Serializable {

    val displayName: String
        get() = senderName?.takeIf { it.isNotBlank() } ?: sender

    val canReply: Boolean
        get() = replyTarget !is ReplyTarget.None

    val canCallBack: Boolean
        get() = !phoneNumber.isNullOrBlank()

    companion object {
        const val EXTRA_KEY = "com.mossesx.xtext.extra.MESSAGE"
    }
}
