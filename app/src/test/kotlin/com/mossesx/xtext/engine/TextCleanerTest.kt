package com.mossesx.xtext.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TextCleanerTest {

    @Test
    fun collapsesWhitespaceAndRepeatedPunctuation() {
        val r = TextCleaner.clean("Hey!!!   are   you   there???")
        assertEquals("Hey! are you there?", r.text)
        assertFalse(r.truncated)
    }

    @Test
    fun replacesLinksAndEmails() {
        val r = TextCleaner.clean("See https://example.com/x?y=1 or mail bob@example.com")
        assertEquals("See a link or mail an email address", r.text)
    }

    @Test
    fun expandsAbbreviationsPreservingCase() {
        assertEquals("Okay, on my way. Thanks!", TextCleaner.clean("Ok, omw. Thx!").text)
        assertEquals("I don't know, be right back", TextCleaner.clean("idk, brb").text)
    }

    @Test
    fun doesNotExpandInsideWords() {
        assertEquals("Run around", TextCleaner.clean("Run around").text)
    }

    @Test
    fun stripsEmoji() {
        assertEquals("Great news!", TextCleaner.clean("Great news! 🎉🎉 👍🏽").text)
    }

    @Test
    fun truncatesAtWordBoundary() {
        val long = (1..50).joinToString(" ") { "word$it" }
        val r = TextCleaner.clean(long, maxChars = 40)
        assertTrue(r.truncated)
        assertTrue(r.text.length <= 40)
        assertFalse(r.text.endsWith(" "))
        assertTrue(long.startsWith(r.text))
    }

    @Test
    fun noTruncationWhenDisabled() {
        val long = "a".repeat(5000)
        assertFalse(TextCleaner.clean(long, maxChars = 0).truncated)
    }
}
