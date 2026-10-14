package com.mossesx.xtext.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VoiceCommandsTest {

    @Test
    fun recognisesBasicCommands() {
        assertEquals(Command.REPLY, VoiceCommands.parseAfterMessage(listOf("reply")).command)
        assertEquals(Command.REPLY, VoiceCommands.parseAfterMessage(listOf("Reply.")).command)
        assertEquals(Command.REPEAT, VoiceCommands.parseAfterMessage(listOf("say that again")).command)
        assertEquals(Command.SKIP, VoiceCommands.parseAfterMessage(listOf("ignore it")).command)
        assertEquals(Command.STOP, VoiceCommands.parseAfterMessage(listOf("Stop reading")).command)
        assertEquals(Command.CALL, VoiceCommands.parseAfterMessage(listOf("call her back")).command)
        assertEquals(Command.READ_MORE, VoiceCommands.parseAfterMessage(listOf("read more")).command)
    }

    @Test
    fun extractsInlineReplyText() {
        val p = VoiceCommands.parseAfterMessage(listOf("reply saying I'm on my way"))
        assertEquals(Command.REPLY, p.command)
        assertEquals("i'm on my way", p.inlineText)

        val q = VoiceCommands.parseAfterMessage(listOf("tell him yes see you at 7"))
        assertEquals(Command.REPLY, q.command)
        assertEquals("yes see you at 7", q.inlineText)
    }

    @Test
    fun bareReplyHasNoInlineText() {
        assertNull(VoiceCommands.parseAfterMessage(listOf("respond")).inlineText)
    }

    @Test
    fun usesLaterAlternativesWhenFirstIsUnknown() {
        val p = VoiceCommands.parseAfterMessage(listOf("we play", "reply"))
        assertEquals(Command.REPLY, p.command)
    }

    @Test
    fun unknownWhenNothingMatches() {
        assertEquals(Command.UNKNOWN, VoiceCommands.parseAfterMessage(listOf("banana bread")).command)
        assertEquals(Command.UNKNOWN, VoiceCommands.parseAfterMessage(emptyList()).command)
    }

    @Test
    fun confirmationCommands() {
        assertEquals(Command.SEND, VoiceCommands.parseConfirmation(listOf("yes send it")).command)
        assertEquals(Command.SEND, VoiceCommands.parseConfirmation(listOf("OK")).command)
        assertEquals(Command.CANCEL, VoiceCommands.parseConfirmation(listOf("never mind")).command)
        assertEquals(Command.CANCEL, VoiceCommands.parseConfirmation(listOf("no")).command)
        assertEquals(Command.CHANGE, VoiceCommands.parseConfirmation(listOf("try again")).command)
        assertEquals(Command.UNKNOWN, VoiceCommands.parseConfirmation(listOf("purple")).command)
    }

    @Test
    fun confirmationChangeWithInlineText() {
        val p = VoiceCommands.parseConfirmation(listOf("change it to see you at eight"))
        assertEquals(Command.CHANGE, p.command)
        assertEquals("see you at eight", p.inlineText)
    }

    @Test
    fun ambiguousWordsMeanDifferentThingsInDifferentPhases() {
        // "again" after a message means repeat; after a read-back it means redo the dictation.
        assertEquals(Command.REPEAT, VoiceCommands.parseAfterMessage(listOf("again")).command)
        assertEquals(Command.CHANGE, VoiceCommands.parseConfirmation(listOf("again")).command)
        // "no" after a message means ignore; after a read-back it means cancel.
        assertEquals(Command.SKIP, VoiceCommands.parseAfterMessage(listOf("no")).command)
        assertEquals(Command.CANCEL, VoiceCommands.parseConfirmation(listOf("no")).command)
    }

    @Test
    fun cancelPhraseDetection() {
        assertTrue(VoiceCommands.isCancelPhrase("Cancel"))
        assertTrue(VoiceCommands.isCancelPhrase("never mind."))
        assertEquals(false, VoiceCommands.isCancelPhrase("I'll cancel the meeting"))
    }
}
