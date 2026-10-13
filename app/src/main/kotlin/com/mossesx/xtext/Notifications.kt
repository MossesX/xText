package com.mossesx.xtext

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.mossesx.xtext.service.XTextService
import com.mossesx.xtext.ui.MainActivity

/** Notification channels and builders used by the service. */
object Notifications {

    const val CHANNEL_STATUS = "xtext_status"
    const val CHANNEL_ALERTS = "xtext_alerts"

    const val ID_SERVICE = 1001
    const val ID_ALERT = 1002

    fun ensureChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_STATUS,
                context.getString(R.string.channel_status),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = context.getString(R.string.channel_status_desc)
                setShowBadge(false)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ALERTS,
                context.getString(R.string.channel_alerts),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.channel_alerts_desc)
            },
        )
    }

    /** The persistent foreground-service notification with hands-free controls. */
    fun buildServiceNotification(
        context: Context,
        statusText: String,
        micActive: Boolean,
        paused: Boolean,
        hasLastMessage: Boolean,
    ): Notification {
        val openApp = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = Notification.Builder(context, CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_stat_xtext)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(statusText)
            .setStyle(Notification.BigTextStyle().bigText(statusText))
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)

        if (!micActive) {
            builder.addAction(
                action(context, R.string.action_enable_voice, XTextService.ACTION_START, 1),
            )
        }
        if (paused) {
            builder.addAction(action(context, R.string.action_resume, XTextService.ACTION_RESUME, 2))
        } else {
            builder.addAction(action(context, R.string.action_pause, XTextService.ACTION_PAUSE, 3))
        }
        if (hasLastMessage && micActive) {
            builder.addAction(
                action(context, R.string.action_reply_last, XTextService.ACTION_REPLY_LAST, 4),
            )
        }
        builder.addAction(action(context, R.string.action_stop, XTextService.ACTION_STOP, 5))
        return builder.build()
    }

    /** Shown when a message arrived but the engine could not be started in the background. */
    fun buildMissedNotification(context: Context, title: String, text: String): Notification {
        val resume = PendingIntent.getForegroundService(
            context,
            10,
            Intent(context, XTextService::class.java).setAction(XTextService.ACTION_START),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_xtext)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(resume)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .build()
    }

    private fun action(context: Context, label: Int, serviceAction: String, code: Int): Notification.Action {
        // Notification actions start the service directly. Launching a foreground
        // service from a user interaction with a notification is one of the cases
        // where Android allows the microphone to be used from the background.
        val intent = Intent(context, XTextService::class.java).setAction(serviceAction)
        val pi = PendingIntent.getForegroundService(
            context,
            code,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Action.Builder(null, context.getString(label), pi).build()
    }
}
