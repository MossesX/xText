package com.mossesx.xtext.engine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class QuietHoursTest {

    private val h = 60

    @Test
    fun sameDayRange() {
        assertTrue(QuietHours.isQuiet(13 * h, 12 * h, 14 * h))
        assertFalse(QuietHours.isQuiet(14 * h, 12 * h, 14 * h))
        assertFalse(QuietHours.isQuiet(11 * h, 12 * h, 14 * h))
    }

    @Test
    fun overnightRange() {
        assertTrue(QuietHours.isQuiet(23 * h, 22 * h, 7 * h))
        assertTrue(QuietHours.isQuiet(3 * h, 22 * h, 7 * h))
        assertFalse(QuietHours.isQuiet(7 * h, 22 * h, 7 * h))
        assertFalse(QuietHours.isQuiet(12 * h, 22 * h, 7 * h))
    }

    @Test
    fun emptyRangeIsNeverQuiet() {
        assertFalse(QuietHours.isQuiet(5 * h, 9 * h, 9 * h))
    }

    @Test
    fun formatsMinutes() {
        assertTrue(QuietHours.format(7 * h + 5) == "07:05")
        assertTrue(QuietHours.format(0) == "00:00")
    }
}
