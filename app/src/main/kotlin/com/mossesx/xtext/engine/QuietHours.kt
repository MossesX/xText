package com.mossesx.xtext.engine

import java.util.Calendar

/** Quiet-hours maths, expressed in minutes since midnight. Handles overnight ranges. */
object QuietHours {

    fun isQuiet(nowMinutes: Int, startMinutes: Int, endMinutes: Int): Boolean {
        if (startMinutes == endMinutes) return false
        return if (startMinutes < endMinutes) {
            nowMinutes in startMinutes until endMinutes
        } else {
            nowMinutes >= startMinutes || nowMinutes < endMinutes
        }
    }

    fun isQuietNow(prefs: Prefs, calendar: Calendar = Calendar.getInstance()): Boolean {
        if (!prefs.quietHoursEnabled) return false
        val now = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
        return isQuiet(now, prefs.quietStart, prefs.quietEnd)
    }

    fun format(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)
}
