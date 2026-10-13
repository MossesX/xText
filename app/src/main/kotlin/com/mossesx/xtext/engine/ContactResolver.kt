package com.mossesx.xtext.engine

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract

/** Resolves phone numbers to contact names, with a small cache. */
class ContactResolver(private val context: Context) {

    private val cache = object : LinkedHashMap<String, String?>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, String?>?) = size > 200
    }

    fun hasPermission(): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    /** Returns the contact display name for [number], or null if unknown or not permitted. */
    @Synchronized
    fun lookup(number: String): String? {
        if (number.isBlank() || !hasPermission()) return null
        if (cache.containsKey(number)) return cache[number]
        val name = runCatching {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(number),
            )
            context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null,
            )?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        }.getOrNull()?.takeIf { it.isNotBlank() }
        cache[number] = name
        return name
    }

    /** Makes a bare number easier to listen to: "+1 555 0100" -> "+1 5 5 5 0 1 0 0". */
    fun speakableNumber(number: String): String {
        val digits = number.filter { it.isDigit() || it == '+' }
        if (digits.length < 4) return number
        return digits.map { it.toString() }.joinToString(" ")
    }
}
