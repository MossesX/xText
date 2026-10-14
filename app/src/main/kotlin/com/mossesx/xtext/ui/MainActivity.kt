package com.mossesx.xtext.ui

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.speech.SpeechRecognizer
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.mossesx.xtext.R
import com.mossesx.xtext.XTextApp
import com.mossesx.xtext.engine.Prefs
import com.mossesx.xtext.engine.QuietHours
import com.mossesx.xtext.engine.ReadMode
import com.mossesx.xtext.service.MessageNotificationListener
import com.mossesx.xtext.service.XTextService

class MainActivity : Activity() {

    private val app get() = application as XTextApp
    private val prefs: Prefs get() = app.prefs

    private lateinit var statusText: TextView
    private lateinit var engineToggle: Button
    private lateinit var testButton: Button
    private lateinit var permissionsContainer: LinearLayout
    private lateinit var appsContainer: LinearLayout
    private lateinit var logText: TextView
    private lateinit var labelRate: TextView
    private lateinit var labelMaxChars: TextView
    private lateinit var btnQuietStart: Button
    private lateinit var btnQuietEnd: Button
    private lateinit var editBlocked: EditText
    private lateinit var editExtraPackage: EditText

    private val switches = HashMap<Int, Switch>()
    private var binding = false
    private var pendingStartAfterPermissions = false

    private val logListener: () -> Unit = { renderLog() }
    private val serviceListener: () -> Unit = { renderStatus() }
    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> if (!binding) renderStatus() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status_text)
        engineToggle = findViewById(R.id.engine_toggle)
        testButton = findViewById(R.id.test_button)
        permissionsContainer = findViewById(R.id.permissions_container)
        appsContainer = findViewById(R.id.apps_container)
        logText = findViewById(R.id.log_text)
        labelRate = findViewById(R.id.label_rate)
        labelMaxChars = findViewById(R.id.label_max_chars)
        btnQuietStart = findViewById(R.id.btn_quiet_start)
        btnQuietEnd = findViewById(R.id.btn_quiet_end)
        editBlocked = findViewById(R.id.edit_blocked_senders)
        editExtraPackage = findViewById(R.id.edit_extra_package)

        engineToggle.setOnClickListener { onToggleEngine() }
        testButton.setOnClickListener { onTest() }
        findViewById<Button>(R.id.btn_clear_log).setOnClickListener { app.log.clear() }
        findViewById<Button>(R.id.btn_save_blocked).setOnClickListener { saveBlockedSenders() }
        findViewById<Button>(R.id.btn_add_package).setOnClickListener { addExtraPackage() }

        bindSwitch(R.id.sw_read_sms, { prefs.readSms }) { prefs.readSms = it }
        bindSwitch(R.id.sw_read_apps, { prefs.readNotifications }) { prefs.readNotifications = it }
        bindSwitch(R.id.sw_read_content, { prefs.readContent }) { prefs.readContent = it }
        bindSwitch(R.id.sw_contact_names, { prefs.useContactNames }) { prefs.useContactNames = it }
        bindSwitch(R.id.sw_contacts_only, { prefs.contactsOnly }) { prefs.contactsOnly = it }
        bindSwitch(R.id.sw_announce_app, { prefs.announceApp }) { prefs.announceApp = it }
        bindSwitch(R.id.sw_quiet, { prefs.quietHoursEnabled }) { prefs.quietHoursEnabled = it }
        bindSwitch(R.id.sw_voice_replies, { prefs.voiceReplies }) { prefs.voiceReplies = it }
        bindSwitch(R.id.sw_confirm, { prefs.confirmBeforeSend }) { prefs.confirmBeforeSend = it }
        bindSwitch(R.id.sw_on_device, { prefs.preferOnDeviceRecognition }) { prefs.preferOnDeviceRecognition = it }
        bindSwitch(R.id.sw_bt_mic, { prefs.useBluetoothMic }) { prefs.useBluetoothMic = it }
        bindSwitch(R.id.sw_call_back, { prefs.allowCallBack }) {
            prefs.allowCallBack = it
            if (it && !granted(Manifest.permission.CALL_PHONE)) {
                requestPermissions(arrayOf(Manifest.permission.CALL_PHONE), REQ_OPTIONAL)
            }
        }

        setupReadModeSpinner()
        setupSeekBars()
        btnQuietStart.setOnClickListener { pickTime(prefs.quietStart) { prefs.quietStart = it; renderQuietHours() } }
        btnQuietEnd.setOnClickListener { pickTime(prefs.quietEnd) { prefs.quietEnd = it; renderQuietHours() } }

        renderApps()
        editBlocked.setText(prefs.blockedSenders.joinToString(", "))
    }

    override fun onResume() {
        super.onResume()
        app.log.addListener(logListener)
        XTextService.listeners += serviceListener
        prefs.registerListener(prefsListener)
        renderAll()
        // The engine may have been started in standby after a reboot; now that the
        // user is looking at the app we can give it the microphone.
        if (prefs.engineRequested && XTextService.isRunning && !XTextService.isMicActive && granted(Manifest.permission.RECORD_AUDIO)) {
            XTextService.start(this, withMic = true)
        }
    }

    override fun onPause() {
        app.log.removeListener(logListener)
        XTextService.listeners -= serviceListener
        prefs.unregisterListener(prefsListener)
        super.onPause()
    }

    // ---- rendering -------------------------------------------------------

    private fun renderAll() {
        binding = true
        switches.values.forEach { it.jumpDrawablesToCurrentState() }
        renderStatus()
        renderPermissions()
        renderQuietHours()
        renderLog()
        binding = false
    }

    private fun renderStatus() {
        val running = XTextService.isRunning
        val mic = XTextService.isMicActive
        val text = when {
            !prefs.engineRequested || !running -> getString(R.string.status_off)
            prefs.isPaused -> getString(R.string.status_paused)
            mic -> getString(R.string.status_listening)
            else -> getString(R.string.status_standby)
        }
        val extras = buildList {
            if (!hasSmsPermissions()) {
                add(getString(if (smsViaNotifications()) R.string.status_sms_via_notifications else R.string.status_sms_unavailable))
            }
            if (!granted(Manifest.permission.RECORD_AUDIO)) add(getString(R.string.status_no_mic))
            if (!SpeechRecognizer.isRecognitionAvailable(this@MainActivity)) add(getString(R.string.status_no_recognizer))
            if (prefs.readNotifications && !MessageNotificationListener.isEnabled(this@MainActivity)) {
                add(getString(R.string.status_no_listener))
            }
        }
        statusText.text = if (extras.isEmpty()) text else text + "\n\n" + extras.joinToString("\n") { "• $it" }
        engineToggle.text = getString(if (running && prefs.engineRequested) R.string.btn_stop else R.string.btn_start)
    }

    private fun renderPermissions() {
        permissionsContainer.removeAllViews()
        val rows = ArrayList<PermissionRow>()
        rows += PermissionRow(getString(R.string.perm_sms), { hasSmsPermissions() }) {
            requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS), REQ_CORE)
        }
        rows += PermissionRow(getString(R.string.perm_mic), { granted(Manifest.permission.RECORD_AUDIO) }) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_CORE)
        }
        rows += PermissionRow(getString(R.string.perm_contacts), { granted(Manifest.permission.READ_CONTACTS) }) {
            requestPermissions(arrayOf(Manifest.permission.READ_CONTACTS), REQ_OPTIONAL)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            rows += PermissionRow(getString(R.string.perm_notifications), { granted(Manifest.permission.POST_NOTIFICATIONS) }) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_CORE)
            }
        }
        rows += PermissionRow(getString(R.string.perm_listener), { MessageNotificationListener.isEnabled(this) }) {
            runCatching { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
                .onFailure { toast(R.string.toast_open_settings_failed) }
        }
        rows += PermissionRow(getString(R.string.perm_battery), { isIgnoringBatteryOptimizations() }) {
            @Suppress("BatteryLife")
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:$packageName"))
            runCatching { startActivity(intent) }.onFailure { toast(R.string.toast_open_settings_failed) }
        }
        if (prefs.allowCallBack) {
            rows += PermissionRow(getString(R.string.perm_call), { granted(Manifest.permission.CALL_PHONE) }) {
                requestPermissions(arrayOf(Manifest.permission.CALL_PHONE), REQ_OPTIONAL)
            }
        }
        for (row in rows) {
            val view = layoutInflater.inflate(R.layout.row_permission, permissionsContainer, false)
            view.findViewById<TextView>(R.id.perm_label).text = row.label
            val ok = row.granted()
            view.findViewById<TextView>(R.id.perm_state).text =
                getString(if (ok) R.string.perm_granted else R.string.perm_missing)
            val button = view.findViewById<Button>(R.id.perm_button)
            button.visibility = if (ok) View.GONE else View.VISIBLE
            button.setOnClickListener { row.request() }
            permissionsContainer.addView(view)
        }
    }

    private fun renderQuietHours() {
        btnQuietStart.text = getString(R.string.quiet_from, QuietHours.format(prefs.quietStart))
        btnQuietEnd.text = getString(R.string.quiet_until, QuietHours.format(prefs.quietEnd))
    }

    private fun renderLog() {
        val entries = app.log.snapshot()
        logText.text = if (entries.isEmpty()) getString(R.string.log_empty) else entries.joinToString("\n") { it.format() }
    }

    private fun renderApps() {
        appsContainer.removeAllViews()
        val watched = prefs.watchedPackages
        val candidates = LinkedHashMap<String, String>()
        candidates.putAll(Prefs.KNOWN_APPS)
        for (p in watched) candidates.putIfAbsent(p, p)
        for ((pkg, fallback) in candidates) {
            val installedLabel = runCatching {
                packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
            }.getOrNull()
            val box = CheckBox(this)
            box.text = if (installedLabel != null) installedLabel else getString(R.string.app_not_installed, fallback)
            box.isEnabled = installedLabel != null || pkg in watched
            box.isChecked = pkg in watched
            box.setOnCheckedChangeListener { _, checked ->
                val set = prefs.watchedPackages.toMutableSet()
                if (checked) set += pkg else set -= pkg
                prefs.watchedPackages = set
            }
            appsContainer.addView(box)
        }
    }

    // ---- actions ---------------------------------------------------------

    private fun onToggleEngine() {
        if (XTextService.isRunning && prefs.engineRequested) {
            XTextService.stop(this)
            prefs.engineRequested = false
            renderStatus()
            return
        }
        val missing = corePermissions().filterNot { granted(it) }
        if (missing.isNotEmpty()) {
            pendingStartAfterPermissions = true
            requestPermissions(missing.toTypedArray(), REQ_CORE)
            return
        }
        startEngine()
    }

    private fun startEngine() {
        prefs.engineRequested = true
        prefs.pausedUntil = 0L
        XTextService.start(this, withMic = granted(Manifest.permission.RECORD_AUDIO))
        if (prefs.readNotifications && !MessageNotificationListener.isEnabled(this)) {
            AlertDialog.Builder(this)
                .setTitle(R.string.dialog_listener_title)
                .setMessage(R.string.dialog_listener_text)
                .setPositiveButton(R.string.dialog_open_settings) { _, _ ->
                    runCatching { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
                }
                .setNegativeButton(R.string.dialog_later, null)
                .show()
        }
        renderStatus()
    }

    private fun onTest() {
        if (!prefs.engineRequested || !XTextService.isRunning) {
            toast(R.string.toast_start_first)
            return
        }
        XTextService.send(this, XTextService.ACTION_TEST)
        toast(R.string.toast_test_started)
    }

    private fun saveBlockedSenders() {
        prefs.blockedSenders = editBlocked.text.toString()
            .split(',', '\n')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
        toast(R.string.toast_saved)
    }

    private fun addExtraPackage() {
        val pkg = editExtraPackage.text.toString().trim()
        if (pkg.isEmpty() || !pkg.contains('.')) {
            toast(R.string.toast_bad_package)
            return
        }
        prefs.watchedPackages = prefs.watchedPackages + pkg
        editExtraPackage.setText("")
        renderApps()
    }

    private fun setupReadModeSpinner() {
        val spinner = findViewById<Spinner>(R.id.spinner_read_mode)
        val labels = listOf(
            getString(R.string.read_mode_always),
            getString(R.string.read_mode_screen_off),
            getString(R.string.read_mode_headset),
        )
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        spinner.setSelection(prefs.readMode.ordinal)
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                prefs.readMode = ReadMode.values()[position]
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
    }

    private fun setupSeekBars() {
        val rate = findViewById<SeekBar>(R.id.seek_rate)
        rate.max = 20 // 0.5x .. 2.5x in 0.1 steps
        rate.progress = ((prefs.speechRate - 0.5f) * 10).toInt().coerceIn(0, 20)
        labelRate.text = getString(R.string.speech_rate, prefs.speechRate)
        rate.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = 0.5f + progress / 10f
                labelRate.text = getString(R.string.speech_rate, value)
                if (fromUser) prefs.speechRate = value
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })

        val max = findViewById<SeekBar>(R.id.seek_max_chars)
        max.max = 19 // 100 .. 2000 characters
        max.progress = (prefs.maxChars / 100 - 1).coerceIn(0, 19)
        labelMaxChars.text = getString(R.string.max_chars, prefs.maxChars)
        max.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = (progress + 1) * 100
                labelMaxChars.text = getString(R.string.max_chars, value)
                if (fromUser) prefs.maxChars = value
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    private fun pickTime(minutes: Int, onPicked: (Int) -> Unit) {
        TimePickerDialog(
            this,
            { _, hour, minute -> onPicked(hour * 60 + minute) },
            minutes / 60,
            minutes % 60,
            true,
        ).show()
    }

    private fun bindSwitch(id: Int, read: () -> Boolean, write: (Boolean) -> Unit) {
        val sw = findViewById<Switch>(id)
        sw.isChecked = read()
        sw.setOnCheckedChangeListener { _, checked -> write(checked) }
        switches[id] = sw
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        renderPermissions()
        if (requestCode == REQ_CORE && pendingStartAfterPermissions) {
            pendingStartAfterPermissions = false
            startEngine()
        } else if (requestCode == REQ_CORE && prefs.engineRequested && XTextService.isRunning) {
            // Microphone granted after the engine started: restart it with microphone access.
            XTextService.start(this, withMic = granted(Manifest.permission.RECORD_AUDIO))
        }
        renderStatus()
        explainBlockedPermissions(permissions, grantResults)
    }

    /**
     * Android stops showing the permission dialog after repeated denials, and
     * never shows it at all for SMS when the installer did not allow-list the
     * restricted SMS permissions. In both cases the only way forward is the
     * app's system settings page, so offer to open it.
     */
    private fun explainBlockedPermissions(permissions: Array<out String>, grantResults: IntArray) {
        val blocked = permissions.indices.filter { i ->
            grantResults.getOrNull(i) == PackageManager.PERMISSION_DENIED && !shouldShowRequestPermissionRationale(permissions[i])
        }.map { permissions[it] }
        if (blocked.isEmpty()) return
        val smsBlocked = blocked.any { it == Manifest.permission.RECEIVE_SMS || it == Manifest.permission.SEND_SMS }
        AlertDialog.Builder(this)
            .setTitle(R.string.dialog_denied_title)
            .setMessage(if (smsBlocked) R.string.dialog_denied_sms_text else R.string.dialog_denied_text)
            .setPositiveButton(R.string.dialog_open_app_settings) { _, _ -> openAppSettings() }
            .setNegativeButton(R.string.dialog_later, null)
            .show()
    }

    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:$packageName"))
        runCatching { startActivity(intent) }.onFailure { toast(R.string.toast_open_settings_failed) }
    }

    // ---- helpers ---------------------------------------------------------

    private class PermissionRow(val label: String, val granted: () -> Boolean, val request: () -> Unit)

    /** Permissions requested when starting; none of them blocks the start. */
    private fun corePermissions(): List<String> = buildList {
        add(Manifest.permission.RECEIVE_SMS)
        add(Manifest.permission.SEND_SMS)
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun hasSmsPermissions(): Boolean =
        granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.SEND_SMS)

    /** Texts can also arrive through the SMS app's notifications when notification access is on. */
    private fun smsViaNotifications(): Boolean {
        if (!prefs.readNotifications || !MessageNotificationListener.isEnabled(this)) return false
        val smsApp = MessageNotificationListener.defaultSmsPackage(this) ?: return false
        return smsApp in prefs.watchedPackages
    }

    private fun granted(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun isIgnoringBatteryOptimizations(): Boolean =
        getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    private fun toast(id: Int) = Toast.makeText(this, id, Toast.LENGTH_SHORT).show()

    companion object {
        private const val REQ_CORE = 1
        private const val REQ_OPTIONAL = 2
    }
}
