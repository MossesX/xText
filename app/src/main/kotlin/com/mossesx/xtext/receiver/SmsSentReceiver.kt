package com.mossesx.xtext.receiver

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import com.mossesx.xtext.XTextApp

/** Logs the delivery result of SMS replies. */
class SmsSentReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_SENT) return
        val app = context.applicationContext as XTextApp
        val address = intent.getStringExtra(EXTRA_ADDRESS) ?: "?"
        val part = intent.getIntExtra(EXTRA_PART, 0)
        if (part != 0) return
        val result = when (resultCode) {
            Activity.RESULT_OK -> return
            SmsManager.RESULT_ERROR_NO_SERVICE -> "no service"
            SmsManager.RESULT_ERROR_RADIO_OFF -> "radio off"
            SmsManager.RESULT_ERROR_NULL_PDU -> "empty message"
            SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "generic failure"
            else -> "error $resultCode"
        }
        app.log.add("SMS to $address was not sent: $result")
    }

    companion object {
        const val ACTION_SENT = "com.mossesx.xtext.action.SMS_SENT"
        const val EXTRA_ADDRESS = "address"
        const val EXTRA_PART = "part"
    }
}
