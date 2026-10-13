package com.mossesx.xtext.model

import android.app.Notification
import android.app.RemoteInput

/**
 * Keeps the notification reply actions we have seen so a spoken reply can be
 * delivered through the originating app's own "Reply" action.
 *
 * Actions are process-local objects, so the registry lives in memory and is
 * keyed by an id that travels inside [ReplyTarget.NotificationReply].
 */
object NotificationReplyRegistry {

    class PendingReply(
        val action: Notification.Action,
        val remoteInput: RemoteInput,
        val packageName: String,
        val createdAt: Long = System.currentTimeMillis(),
    )

    private const val MAX_ENTRIES = 64
    private const val MAX_AGE_MS = 6L * 60 * 60 * 1000

    private val entries = LinkedHashMap<String, PendingReply>()
    private var counter = 0L

    @Synchronized
    fun register(action: Notification.Action, remoteInput: RemoteInput, packageName: String): String {
        prune()
        val id = "${packageName}#${++counter}"
        entries[id] = PendingReply(action, remoteInput, packageName)
        while (entries.size > MAX_ENTRIES) {
            val oldest = entries.keys.first()
            entries.remove(oldest)
        }
        return id
    }

    @Synchronized
    fun get(id: String): PendingReply? {
        prune()
        return entries[id]
    }

    private fun prune() {
        val cutoff = System.currentTimeMillis() - MAX_AGE_MS
        val it = entries.entries.iterator()
        while (it.hasNext()) {
            if (it.next().value.createdAt < cutoff) it.remove()
        }
    }
}
