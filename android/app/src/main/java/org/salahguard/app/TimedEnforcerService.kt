package org.salahguard.app

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.os.*
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/** Visible scheduled prayer timer. No app-usage inspection or app-opening triggers. */
class TimedEnforcerService : Service() {
  private lateinit var worker: HandlerThread
  private lateinit var handler: Handler
  private var lastCleanup = 0L
  companion object {
    @Volatile var running = false; private set
    fun reconcile(c: Context) {
      if (!EnforcerServiceRules.enabled(NotificationAudio.settings(c))) c.stopService(Intent(c, TimedEnforcerService::class.java))
      else if (!running) runCatching { c.startForegroundService(Intent(c, TimedEnforcerService::class.java)) }
        .onFailure { android.util.Log.i("DeenPath", "Open DeenPath to resume the reminder service") }
    }
  }
  override fun onBind(intent: Intent?) = null
  override fun onCreate() {
    super.onCreate()
    worker = HandlerThread("DeenPathPrayerTimer").apply { start() }
    handler = Handler(worker.looper)

  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel("dp_enforcer_service_v1", "Prayer reminder service", NotificationManager.IMPORTANCE_LOW))
    val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val stop = PendingIntent.getService(this, 1, Intent(this, TimedEnforcerService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val note = NotificationCompat.Builder(this, "dp_enforcer_service_v1").setSmallIcon(R.drawable.ic_notification).setContentTitle("DeenPath · Prayer reminders")
      .setContentText("Keeps scheduled prayer reminders active. Tap to open DeenPath.").setContentIntent(open).setOngoing(true).setSilent(true)
      .addAction(0, "Turn off Enforcer", stop).build()
    if (Build.VERSION.SDK_INT >= 34) startForeground(2510, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(2510, note)
    if (intent?.action == "stop") {
      handler.post {
        LocalDatabase(this).use { db -> db.update { root -> val settings=root.getJSONObject("settings").put("enforcer", false)
          val portable=JSONObject(settings.toString()); for(key in listOf("api","soundUris","soundNames","privateActivityReminders","privateCheckinDoneDay","privatePenaltyReminders"))portable.remove(key)
          NativeRecords.put(root,"user_settings","preferences",portable); root } }
        NativeSignals.changed(this); OverlayReminderService.refresh(this); ReminderScheduler.suppressCompleted(this); ReminderScheduler.rebuild(this); stopSelf()
      }
      return START_NOT_STICKY
    }
    if (!running) { running = true; handler.post(poll) }
    return START_STICKY
  }
  private val poll = object : Runnable {
    override fun run() {
      try {
        val s = NotificationAudio.settings(this@TimedEnforcerService)
        if (!EnforcerServiceRules.enabled(s)) { stopSelf(); return }
        val now = System.currentTimeMillis()
        if (LocalDatabase(this@TimedEnforcerService).use { it.hasDueReminder(now) }) {
          ReminderDiagnostics.record(this@TimedEnforcerService,"foreground_timer_delivery")
          ReminderScheduler.dispatch(this@TimedEnforcerService)
        }
        if (now - lastCleanup >= 1000) {
          ReminderScheduler.suppressCompleted(this@TimedEnforcerService)
          lastCleanup = now
        }
      } catch (_: Exception) { /* Device temporarily unavailable: retry; OS alarm remains armed. */ }
      handler.postDelayed(this, 1000)
    }
  }
  override fun onTaskRemoved(rootIntent:Intent?){
    ReminderDiagnostics.record(this,"recents_task_removed")
    if(EnforcerServiceRules.enabled(NotificationAudio.settings(this)))runCatching{ReminderScheduler.armNext(this);ReminderMaintenance.request(this,true)}.onFailure{ReminderDiagnostics.record(this,"recents_alarm_restore_deferred")}
    super.onTaskRemoved(rootIntent)
  }
  override fun onDestroy() { running = false; handler.removeCallbacksAndMessages(null); worker.quitSafely(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy() }
}
