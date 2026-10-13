package com.mossesx.xtext.engine

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** A small persisted ring buffer of what the engine did, shown in the app. */
class ActivityLog(context: Context) {

    data class Entry(val time: Long, val text: String) {
        fun format(): String = "${FORMAT.format(Date(time))}  $text"
    }

    private val sp = context.applicationContext.getSharedPreferences("xtext_log", Context.MODE_PRIVATE)
    private val entries = ArrayDeque<Entry>()
    private val listeners = mutableSetOf<() -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    init {
        runCatching {
            val arr = JSONArray(sp.getString("entries", "[]"))
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                entries.addLast(Entry(o.getLong("t"), o.getString("m")))
            }
        }
    }

    @Synchronized
    fun add(text: String) {
        Log.i(TAG, text)
        entries.addLast(Entry(System.currentTimeMillis(), text))
        while (entries.size > MAX) entries.removeFirst()
        persist()
        main.post { listeners.toList().forEach { it() } }
    }

    @Synchronized
    fun snapshot(): List<Entry> = entries.toList().asReversed()

    @Synchronized
    fun clear() {
        entries.clear()
        persist()
        main.post { listeners.toList().forEach { it() } }
    }

    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }

    private fun persist() {
        val arr = JSONArray()
        entries.forEach { arr.put(JSONObject().put("t", it.time).put("m", it.text)) }
        sp.edit().putString("entries", arr.toString()).apply()
    }

    companion object {
        private const val TAG = "xText"
        private const val MAX = 80
        private val FORMAT = SimpleDateFormat("MMM d HH:mm", Locale.getDefault())
    }
}
