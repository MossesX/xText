package com.mossesx.xtext

import android.app.Application
import com.mossesx.xtext.engine.ActivityLog
import com.mossesx.xtext.engine.Prefs

class XTextApp : Application() {

    lateinit var prefs: Prefs
        private set

    lateinit var log: ActivityLog
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = Prefs(this)
        log = ActivityLog(this)
        Notifications.ensureChannels(this)
    }

    companion object {
        @Volatile
        lateinit var instance: XTextApp
            private set
    }
}
