package com.mossesx.xtext.engine

/**
 * Turns raw message text into something that sounds natural when spoken.
 * Pure Kotlin so it can be unit tested without Android.
 */
object TextCleaner {

    private val URL = Regex("""(?i)\b((https?://|www\.)\S+|\S+\.(com|net|org|io|co|me|ly|app|dev)(/\S*)?)""")
    private val EMAIL = Regex("""[\w.+-]+@[\w-]+\.[\w.-]+""")
    private val WHITESPACE = Regex("""\s+""")
    private val REPEATED_PUNCT = Regex("""([!?.,])\1{1,}""")
    private val WORD = Regex("""\b[\w']+\b""")

    /** Short-hand that text-to-speech engines read badly. Matched case-insensitively as whole words. */
    private val ABBREVIATIONS = mapOf(
        "u" to "you",
        "ur" to "your",
        "r" to "are",
        "y" to "why",
        "k" to "okay",
        "kk" to "okay",
        "ok" to "okay",
        "pls" to "please",
        "plz" to "please",
        "thx" to "thanks",
        "ty" to "thank you",
        "np" to "no problem",
        "brb" to "be right back",
        "omw" to "on my way",
        "idk" to "I don't know",
        "idc" to "I don't care",
        "ttyl" to "talk to you later",
        "btw" to "by the way",
        "fyi" to "for your information",
        "imo" to "in my opinion",
        "lmk" to "let me know",
        "asap" to "as soon as possible",
        "tmrw" to "tomorrow",
        "tmr" to "tomorrow",
        "2moro" to "tomorrow",
        "b4" to "before",
        "gr8" to "great",
        "l8r" to "later",
        "w/" to "with",
        "msg" to "message",
        "min" to "minute",
        "mins" to "minutes",
        "hr" to "hour",
        "hrs" to "hours",
        "lol" to "haha",
        "lmao" to "haha",
        "rofl" to "haha",
        "omg" to "oh my god",
        "nvm" to "never mind",
        "rn" to "right now",
        "wyd" to "what are you doing",
        "wya" to "where are you",
        "hbu" to "how about you",
        "ikr" to "I know right",
        "tbh" to "to be honest",
        "atm" to "at the moment",
        "bc" to "because",
        "cuz" to "because",
        "ppl" to "people",
        "dm" to "direct message",
        "grp" to "group",
    )

    /**
     * Cleans [raw] for speech.
     * @param maxChars truncate after roughly this many characters; 0 disables truncation.
     * @return the spoken text and whether it was truncated.
     */
    fun clean(raw: String, maxChars: Int = 0, expandAbbreviations: Boolean = true): Result {
        var text = raw.trim()
        text = text.replace(EMAIL, " an email address ")
        text = text.replace(URL, " a link ")
        text = stripEmoji(text)
        text = text.replace(REPEATED_PUNCT, "$1")
        if (expandAbbreviations) {
            text = WORD.replace(text) { m ->
                val w = m.value
                val replacement = ABBREVIATIONS[w.lowercase()]
                if (replacement == null) w else matchCase(w, replacement)
            }
        }
        text = text.replace(WHITESPACE, " ").trim()

        var truncated = false
        if (maxChars > 0 && text.length > maxChars) {
            val cut = text.lastIndexOf(' ', maxChars).let { if (it < maxChars / 2) maxChars else it }
            text = text.substring(0, cut).trimEnd { it == ' ' || it == ',' || it == ';' }
            truncated = true
        }
        return Result(text, truncated)
    }

    /** Removes pictographic characters that TTS engines either skip or read as "unknown". */
    fun stripEmoji(text: String): String {
        val sb = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val cp = text.codePointAt(i)
            val len = Character.charCount(cp)
            if (!isPictographic(cp)) sb.appendCodePoint(cp)
            i += len
        }
        return sb.toString()
    }

    private fun isPictographic(cp: Int): Boolean = when {
        cp in 0x1F000..0x1FAFF -> true      // emoji & pictographs, incl. supplemental
        cp in 0x2600..0x27BF -> true        // misc symbols & dingbats
        cp in 0x2B00..0x2BFF -> true        // arrows & misc symbols
        cp == 0x200D -> true                // zero-width joiner
        cp in 0xFE00..0xFE0F -> true        // variation selectors
        cp in 0x1F1E6..0x1F1FF -> true      // regional indicators (flags)
        cp in 0xE0020..0xE007F -> true      // tags
        else -> false
    }

    private fun matchCase(original: String, replacement: String): String = when {
        original.length > 1 && original.all { !it.isLetter() || it.isUpperCase() } && replacement.length <= 3 ->
            replacement.uppercase()
        original.first().isUpperCase() -> replacement.replaceFirstChar { it.uppercase() }
        else -> replacement
    }

    data class Result(val text: String, val truncated: Boolean)
}
