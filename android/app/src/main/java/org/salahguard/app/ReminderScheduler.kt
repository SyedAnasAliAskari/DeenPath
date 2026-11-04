package org.salahguard.app

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.*
import com.batoulapps.adhan.*
import com.batoulapps.adhan.data.DateComponents
import java.time.*
import org.json.JSONObject
import org.json.JSONArray

object ReminderScheduler {
  private val categories =
    listOf("gentle", "warning", "strict", "missed", "qaza", "routine", "test")

  private fun prayerFinished(p: JSONObject): Boolean {
    if (p.optString("status") == "na") return true
    if (!p.isNull("qazaAt") && p.optString("qazaAt").isNotEmpty()) return true
    if (p.isNull("completedAt") || p.optString("completedAt").isEmpty()) return false
    return try {
      val at = Instant.parse(p.getString("completedAt"))
      val start = Instant.parse(p.getString("windowStart"))
      val end = Instant.parse(p.getString("windowEnd"))
      at >= start && at < end
    } catch (_: Exception) {
      true
    }
  }

  fun channels(c: Context) {
    val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
          "sg_overlay_v2",
          "DeenPath reminder on screen",
          NotificationManager.IMPORTANCE_LOW,
        )
        .apply { setSound(null, null) }
    )
    val settings = NotificationAudio.settings(c)
    categories.forEach {
      NotificationAudio.ensure(
        c,
        it,
        settings.optBoolean("silent"),
        settings.optBoolean("vibration", true),
      )
    }
  }

  private fun channel(category: String, silent: Boolean, vibration: Boolean) =
    "sg_v1_${category}_${silent}_${vibration}"

  private fun pending(c: Context, r: JSONObject): PendingIntent {
    val intent =
      Intent(c, ReminderReceiver::class.java)
        .setData(Uri.parse("salahguard://alarm/" + Uri.encode(r.getString("id"))))
        .putExtra("payload", r.toString())
    return PendingIntent.getBroadcast(
      c,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private const val DISPATCH = "org.salahguard.app.DISPATCH"

  private fun dispatchIntent(c: Context) =
    PendingIntent.getBroadcast(
      c,
      2502,
      Intent(c, ReminderReceiver::class.java)
        .setAction(DISPATCH)
        .setData(Uri.parse("salahguard://dispatch/v2")),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  @Synchronized
  fun migrateLegacy(c: Context) {
    val prefs = c.getSharedPreferences("alarm-migration", Context.MODE_PRIVATE)
    if (prefs.getBoolean("single_dispatch_v2", false)) return
    val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= 34) manager.cancelAll()
    else
      LocalDatabase(c).use { db ->
        db.reminderList().forEach { r ->
          val intent =
            Intent(c, ReminderReceiver::class.java)
              .setData(Uri.parse("salahguard://alarm/" + Uri.encode(r.getString("id"))))
          PendingIntent.getBroadcast(
              c,
              0,
              intent,
              PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            ?.let {
              manager.cancel(it)
              it.cancel()
            }
        }
      }
    check(prefs.edit().putBoolean("single_dispatch_v2", true).commit())
  }

  @Synchronized
  fun armNext(c: Context) {
    migrateLegacy(c)
    val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = dispatchIntent(c)
    val rows = LocalDatabase(c).use { it.reminderList() }; val times=rows.map{it.getLong("at")}
    
    AlarmPolicy.arm(
      System.currentTimeMillis(),
      times,
      object : AlarmPolicy.Driver {
        override fun cancel() {
          manager.cancel(intent)
        }

        override fun schedule(at: Long) {
          try {
            if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) {
              manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
              ReminderDiagnostics.record(c,"exact_idle_alarm_armed")
            }
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
          } catch (_: SecurityException) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
          }
        }
      },
    )
  }

  @Synchronized
  fun plan(c: Context, rows: List<JSONObject>, replace: Boolean) {
    migrateLegacy(c)
    LocalDatabase(c).use { db ->
      val current=runCatching { JSONObject(db.load()) }.getOrDefault(JSONObject())
      val settings=current.optJSONObject("settings")?:JSONObject()
      val future = rows.filter { it.getLong("at") > System.currentTimeMillis() && PrayerReminderRules.eventInWindow(it,it.getLong("at")) && ReminderConfiguration.matches(it, settings) }
        .onEach { if (it.optString("route").startsWith("prayer:") && !it.has("calculation")) it.put("calculation", ReminderConfiguration.key(settings)) }
      if (replace) {
        val extras =
          db.reminderList().filter {
            AlarmPolicy.keepQueued(System.currentTimeMillis(), it.getLong("at"), it.optString("id")) && PrayerReminderRules.eventInWindow(it,it.getLong("at")) &&
              shouldNotify(current, it.optString("route")) && ReminderConfiguration.matches(it, settings)
          }
        db.replaceReminders((future + extras).distinctBy { it.getString("id") })
      } else future.forEach { db.putReminder(it) }
    }
    armNext(c)
  }

  fun add(c: Context, r: JSONObject) = plan(c, listOf(r), false)

  @Synchronized
  fun cancelTests(c: Context) {
    synchronized(LocalDatabase.snapshotLock) {
      LocalDatabase(c).use { db ->
        val sql=db.writableDatabase
        sql.beginTransaction()
        try {
          db.reminderList().filter { it.optString("route") == "test" }.forEach { db.removeReminder(it.getString("id")) }
          db.meta("reminder.snooze:test","0")
          val event=runCatching { JSONObject(db.meta("reminder.event:test") ?: "") }.getOrNull()
          if(event!=null) db.meta("reminder.event:test",event.put("handled",true).toString())
          sql.setTransactionSuccessful()
        } finally { sql.endTransaction() }
      }
    }
    val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.activeNotifications.filter { it.notification.extras.getString("sg_route") == "test" }.forEach { manager.cancel(it.id) }
    OverlayReminderService.refresh(c)
    armNext(c)
    ReminderDiagnostics.record(c,"test_reminders_cancelled")
  }

  @Synchronized
  fun clear(c: Context) {
    migrateLegacy(c)
    (c.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(dispatchIntent(c))
    LocalDatabase(c).use { it.clearReminders() }
  }

  @Synchronized
  fun dispatch(c: Context) {
    val now = System.currentTimeMillis()
    val due =
      LocalDatabase(c).use { db ->
        db
          .reminderList()
          .filter { it.getLong("at") <= now + 500 }
          .sortedBy { it.getLong("at") }
          .also { rows -> rows.forEach { db.removeReminder(it.getString("id")) } }
      }
    try {
      AlarmPolicy.latestDue(due,now).forEach {
        runCatching { show(c, it) }.onFailure { error -> android.util.Log.e("DeenPath", "Reminder delivery failed", error) }
      }
    } finally {
      armNext(c)
    }
  }

  @Synchronized
  fun rebuild(c: Context) {
    val root = LocalDatabase(c).use { it.load() }
    if (root.isEmpty()) return
    val snapshot = JSONObject(root)
    val s = snapshot.getJSONObject("settings")
    val records = snapshot.getJSONArray("records")
    val generated = mutableListOf<JSONObject>()
    val zone = ZoneId.of(s.getString("timezone"))
    val day = LocalDate.now(zone)
    val lang = s.optString("lang", "en")
    val labels =
      when (lang) {
        "ar" -> listOf("فجر", "ظهر", "عصر", "مغرب", "عشاء")
        "ur" -> listOf("فجر", "ظہر", "عصر", "مغرب", "عشاء")
        else -> listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
      }
    val names = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
    val stages =
      when (lang) {
        "ar" -> listOf("تذكير لطيف", "تنبيه", "تذكير أخير", "فائتة")
        "ur" -> listOf("نرم یاد دہانی", "تنبیہ", "آخری یاد دہانی", "رہ گئی")
        else -> listOf("Gentle", "Warning", "Strict", "Prayer window ended")
      }
    val method =
      when (s.optString("method")) {
        "UmmAlQura" -> CalculationMethod.UMM_AL_QURA
        "Dubai" -> CalculationMethod.DUBAI
        "MuslimWorldLeague" -> CalculationMethod.MUSLIM_WORLD_LEAGUE
        "Egyptian" -> CalculationMethod.EGYPTIAN
        "NorthAmerica" -> CalculationMethod.NORTH_AMERICA
        "MoonsightingCommittee" -> CalculationMethod.MOON_SIGHTING_COMMITTEE
        "Singapore" -> CalculationMethod.SINGAPORE
        else -> CalculationMethod.KARACHI
      }
    val params = method.parameters
    params.madhab = if (s.optBoolean("hanafi")) Madhab.HANAFI else Madhab.SHAFI
    val a = s.getJSONArray("adjustments")
    params.adjustments.fajr = a.getInt(0)
    params.adjustments.dhuhr = a.getInt(1)
    params.adjustments.asr = a.getInt(2)
    params.adjustments.maghrib = a.getInt(3)
    params.adjustments.isha = a.getInt(4)
    val coordinates = Coordinates(s.getDouble("lat"), s.getDouble("lng"))
    fun base(id: String, at: Long, title: String, body: String, category: String, route: String) =
      JSONObject()
        .put("id", if (route.startsWith("prayer:")) ReminderConfiguration.eventId(id, snapshot.optString("owner"), s) else id)
        .put("at", at)
        .put("title", title)
        .put("body", body)
        .put("category", category)
        .put("route", route)
        .put("silent", s.optBoolean("silent"))
        .put("vibration", s.optBoolean("vibration", true))
        .put("owner", snapshot.optString("owner"))
        .put("calculation", ReminderConfiguration.key(s))
    for (offset in -1L until AlarmPolicy.PLAN_DAYS.toLong()) {
      val d = day.plusDays(offset)
      if (s.optBoolean("enforcer")) {
        val windows = PrayerWindows.calculate(d, s)
        val starts = windows.map { it.start }.toMutableList()
        val ends = windows.map { it.end }.toMutableList()
        for (i in 0..4) {
          val key = "$d:${names[i]}"
          var completed = false
          var midday = ""
          for (j in 0 until records.length()) {
            val r = records.getJSONObject(j)
            if (
              r.optString("entity") == "prayer_records" &&
                r.optString("id") == key &&
                !r.optBoolean("deleted")
            ) {
              val data = r.getJSONObject("data")
              midday = data.optString("midday")
              val saved = PrayerWindows.recorded(windows[i], data)
              starts[i] = saved.start
              ends[i] = saved.end
              if (prayerFinished(data)) completed = true
            }
          }
          if (completed) continue
          for(tick in PrayerCadence.ticks(starts[i],ends[i],s)){
            val k=tick.stage;val time=tick.at;val ref=if(k==3)"39:53" else if(k==0)"20:14" else "4:103"
            generated.add(base("$key:${categories[k]}:$time",time,"${if(i==1&&midday!="Dhuhr"&&d.dayOfWeek==DayOfWeek.FRIDAY)when(lang){"ur"->"جمعہ";"ar"->"الجمعة";else->"Jummah"}else labels[i]} - ${stages[k]}",NativeContent.reminder(c,ref,NativeContent.language(s)),categories[k],"prayer:$key").put("midday",midday).put("windowStart",Instant.ofEpochMilli(starts[i]).toString()).put("windowEnd",Instant.ofEpochMilli(ends[i]).toString()).put("lang",lang))
          }
        }
      }
      for (j in 0 until records.length()) {
        val record = records.getJSONObject(j)
        if (record.optString("entity") != "routines" || record.optBoolean("deleted")) continue
        val r = record.getJSONObject("data")
        val rz = ZoneId.of(r.getString("timezone"))
        val rd = LocalDate.now(rz).plusDays(offset)
        if(r.optString("frequency")=="after_prayer") {
          for(window in RoutinePeriods.starts(r,rd)) generated.add(base(record.getString("id")+":"+window.id,window.start,r.getString("title"),EnforcerUi.text(c,"Your after-prayer practice is ready.","نماز کے بعد کا معمول تیار ہے۔","وردك بعد الصلاة جاهز."),"routine","routine:"+record.getString("id")))
          continue
        }
        val start = LocalDate.parse(r.getString("startDate"))
        if (rd < start) continue
        val due = NativePlanRules.due(r, rd)
        if (due) {
          val at =
            rd.atTime(LocalTime.parse(r.getString("time"))).atZone(rz).toInstant().toEpochMilli()
          val id = record.getString("id")
          val routineReminder =
            base(
              "$id:$rd",
              at,
              r.getString("title"),
              when (lang) {
                "ar" -> "حان وقت وردك"
                "ur" -> "آپ کے معمول کا وقت"
                else -> "A moment for your routine"
              },
              "routine",
              "routine:$id",
            )
          generated.add(routineReminder)
          val followup = r.optInt("followup", 0)
          if (followup in 1..360)
            generated.add(
              JSONObject(routineReminder.toString())
                .put("id", "$id:$rd:followup")
                .put("at", at + followup * 60000L)
            )
        }
      }
    }
    for (offset in 0 until AlarmPolicy.PLAN_DAYS) {
      val date = day.plusDays(offset.toLong())
      val body =
        when (lang) {
          "ur" ->
            "\u0622\u067e \u06a9\u06cc \u0627\u06cc\u06a9 \u0630\u0627\u062a\u06cc \u0633\u0631\u06af\u0631\u0645\u06cc \u0645\u0646\u062a\u0638\u0631 \u06c1\u06d2"
          "ar" ->
            "\u0644\u062f\u064a\u0643 \u0646\u0634\u0627\u0637 \u0634\u062e\u0635\u064a \u0628\u0627\u0646\u062a\u0638\u0627\u0631\u0643"
          else -> "Your private Secrets check-in is ready."
        }
      if (
        s.optBoolean("privateReminder") && s.optString("privateCheckinDoneDay") != date.toString()
      )
        generated.add(
          base(
            "private:$date",
            date
              .atTime(LocalTime.parse(s.optString("privateTime", "21:30")))
              .atZone(zone)
              .toInstant()
              .toEpochMilli(),
            "DeenPath",
            body,
            "routine",
            "private",
          ).put("checkinDay",date.toString())
        )
      if (s.optBoolean("journalReminder"))
        generated.add(
          base(
            "journal:$date",
            date.atTime(20, 30).atZone(zone).toInstant().toEpochMilli(),
            "DeenPath",
            body,
            "routine",
            "journal",
          )
        )
    }
    val penalties=s.optJSONArray("privatePenaltyReminders")?:JSONArray()
    for(i in 0 until penalties.length()){
      val item=penalties.getJSONObject(i)
      for(at in PenaltyRules.times(item.optString("createdAt"),item.optString("dueAt")))generated.add(
        base("penalty:"+item.getString("id")+":"+at,at,"DeenPath","A private penalty is due within 24 hours. Open Secrets to review it.","routine","secretPenalty:"+item.getString("id")).put("penaltyDueAt",item.getString("dueAt"))
      )
    }
    val privatePlans = s.optJSONArray("privateActivityReminders")
    if (privatePlans != null)
      for (i in 0 until privatePlans.length()) {
        val item = privatePlans.getJSONObject(i)
        generated.add(
          base(
            "personal:" + item.getString("id"),
            item.getLong("at"),
            "DeenPath",
            when (lang) {
              "ur" ->
                "\u0622\u067e \u06a9\u06cc \u0630\u0627\u062a\u06cc \u0633\u0631\u06af\u0631\u0645\u06cc \u0645\u0646\u062a\u0638\u0631 \u06c1\u06d2"
              "ar" -> "\u0644\u062f\u064a\u0643 \u0646\u0634\u0627\u0637 \u0634\u062e\u0635\u064a"
              else -> "Your private Secrets check-in is ready."
            },
            "routine",
            "privateActivity:" + item.getString("id"),
          )
        )
      }
    plan(
      c,
      generated.filter {
        it.optString("route").startsWith("prayer:") ||
          !NativePlanRules.quiet(Instant.ofEpochMilli(it.getLong("at")), s)
      },
      true,
    )
  }

  fun shouldNotify(c:Context,route:String):Boolean {
    if(route=="test")return true
    val raw=LocalDatabase(c).use{it.load()};if(raw.isEmpty())return false
    return shouldNotify(JSONObject(raw),route)
  }
  fun shouldNotify(root:JSONObject,route:String,now:Long=System.currentTimeMillis()):Boolean {
    if(route=="test")return true
    val records=root.optJSONArray("records")?:return false
    fun find(entity: String, id: String): JSONObject? {
      for (i in 0 until records.length()) {
        val r = records.getJSONObject(i)
        if (r.optString("entity") == entity && r.optString("id") == id && !r.optBoolean("deleted"))
          return r.getJSONObject("data")
      }
      return null
    }
    if(route.startsWith("secretPenalty:")){
      val plans=root.getJSONObject("settings").optJSONArray("privatePenaltyReminders")?:return false
      val item=(0 until plans.length()).map{plans.getJSONObject(it)}.firstOrNull{it.optString("id")==route.substringAfter(':')}?:return false
      return PenaltyRules.pending(item,(0 until records.length()).map{records.getJSONObject(it)},now)
    }
    if (route.startsWith("privateActivity:")) {
      val plans =
        root.getJSONObject("settings").optJSONArray("privateActivityReminders")
          ?: return false
      return (0 until plans.length()).any {
        plans.getJSONObject(it).optString("id") == route.substringAfter(':')
      }
    }
    if (route == "private")
      return root.getJSONObject("settings").optBoolean("privateReminder") && root.getJSONObject("settings").optString("privateCheckinDoneDay") !=
        Instant.ofEpochMilli(now).atZone(ZoneId.of(root.getJSONObject("settings").getString("timezone"))).toLocalDate()
          .toString()
    if (route.startsWith("qaza:")) return false
    if (route.startsWith("prayer:")) return PrayerReminderRules.pending(root,route,now)
    if (route.startsWith("routine:")) {
      val id = route.substringAfter(':')
      val r = find("routines", id) ?: return false
      val zone = ZoneId.of(r.getString("timezone"))
      val period = RoutinePeriods.key(r, Instant.ofEpochMilli(now), records)
      return find("routine_completions", "$id:$period") == null
    }
    return true
  }

  fun suppressCompleted(c: Context) {
    val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.activeNotifications.forEach { entry ->
      val route = entry.notification.extras.getString("sg_route")
      if (route != null) {
        val event = LocalDatabase(c).use { db -> runCatching { JSONObject(db.meta("reminder.event:" + route) ?: "") }.getOrNull() }
        if (!shouldNotify(c, route) || event != null && !PrayerActions.active(c, event)) manager.cancel(entry.id)
      }
    }
  }

  @Suppress("DEPRECATION")
  fun show(c: Context, r: JSONObject) {
    ReminderDiagnostics.record(c,"reminder_received")
    if(!PrayerReminderRules.eventInWindow(r,System.currentTimeMillis())) {
      ReminderDiagnostics.record(c,"expired_prayer_suppressed")
      (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(r.optString("route").hashCode())
      return
    }
    channels(c)
    val snoozedUntil=LocalDatabase(c).use{it.meta("reminder.snooze:"+r.optString("route"))?.toLongOrNull()?:0L}
    if(AlarmPolicy.snoozed(System.currentTimeMillis(),snoozedUntil))return
    if (
      !r.optString("route").startsWith("prayer:") &&
        !r.optString("id").startsWith("test:") &&
        NativePlanRules.quiet(Instant.now(), NotificationAudio.settings(c))
    )
      return
    if (!shouldNotify(c, r.getString("route"))) return
    val snapshot = LocalDatabase(c).use { JSONObject(it.load().ifEmpty { "{}" }) }
    if (r.has("owner") && r.optString("owner") != snapshot.optString("owner")) return
    ReminderPassages.prepare(c,r,snapshot.optJSONObject("settings")?:JSONObject())
    if (!PrayerActions.activate(c, r)) { ReminderDiagnostics.record(c,"event_rejected"); return }
    if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) {
      ReminderDiagnostics.record(c,"notification_permission_blocked")
      return
    }
    val intent =
      Intent(c, MainActivity::class.java)
        .putExtra("reminder", r.getString("route"))
        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .setData(Uri.parse("salahguard://open/" + Uri.encode(r.getString("id"))))
    val open =
      PendingIntent.getActivity(
        c,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    fun actionIntent(action:PrayerAction)=ReminderPendingIntents.action(c,r,action)
    val snooze = actionIntent(PrayerAction.SNOOZE)
    val end = runCatching { Instant.parse(r.getString("windowEnd")).toEpochMilli() }.getOrNull()
    val timing = EnforcerUi.timing(c, r)
    val builder =
      NotificationCompat.Builder(
          c,
          NotificationAudio.ensure(
            c,
            r.getString("category"),
            r.optBoolean("silent"),
            r.optBoolean("vibration", true),
          ),
        )
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(ReminderText.title(r))
        .setColor(android.graphics.Color.rgb(39,100,72))
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setVisibility(if(r.optString("route")=="private"||r.optString("route").startsWith("secretPenalty:"))NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
        .setSubText("DeenPath")
        .addExtras(android.os.Bundle().apply { putString("sg_route", r.optString("route")) })
        .setContentText(if (timing.isNotEmpty()) timing else r.getString("body").lineSequence().firstOrNull() ?: r.getString("body"))
        .setStyle(NotificationCompat.BigTextStyle().bigText(timing + "\n\n" + r.getString("body")))
        .setContentIntent(open)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
    val start = runCatching { Instant.parse(r.getString("windowStart")).toEpochMilli() }.getOrNull()
    val waiting = start != null && start > System.currentTimeMillis()
    val target = if(waiting) start else end
    if (target != null && target > System.currentTimeMillis()) {
      builder.setWhen(target).setUsesChronometer(true).setChronometerCountDown(true)
      if(waiting) builder.setSubText(EnforcerUi.text(c,"Starts in","آغاز میں باقی","تبدأ خلال"))
    }
    if (r.optString("route").startsWith("prayer:") && end != null) {
      builder.setTimeoutAfter((end-System.currentTimeMillis()).coerceAtLeast(1))
      val action = PrayerAction.PRAYED
      builder.addAction(0, EnforcerUi.actionLabel(c, action), actionIntent(action))
    }
    if(r.optString("route").startsWith("secretPenalty:")){
      val deadline=runCatching{Instant.parse(r.getString("penaltyDueAt")).toEpochMilli()}.getOrNull()
      if(deadline!=null)builder.setTimeoutAfter((deadline-System.currentTimeMillis()).coerceAtLeast(1))
    }else builder.addAction(0, NativeUi.text(c,"later"), snooze)
    builder.addAction(0, EnforcerUi.actionLabel(c,PrayerAction.CLOSE), actionIntent(PrayerAction.CLOSE))
    val settings = NotificationAudio.settings(c)
    val locked = (c.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
    val interactive = (c.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive
    val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel=manager.getNotificationChannel(NotificationAudio.id(c,r.getString("category"),r.optBoolean("silent"),r.optBoolean("vibration",true)))
    if(channel?.importance==NotificationManager.IMPORTANCE_NONE){ReminderDiagnostics.record(c,"notification_channel_blocked");return}
    if(locked&&!interactive&&!settings.optBoolean("wakeEnforcer"))ReminderDiagnostics.record(c,"screen_wake_disabled")
    if ((r.optString("route").startsWith("prayer:") || r.optString("route")=="private" || r.optBoolean("testOverlay")) && locked && settings.optBoolean("overlay") && (interactive || settings.optBoolean("wakeEnforcer"))) {
      if (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()) {
        val options=if(Build.VERSION.SDK_INT>=35)ActivityOptions.makeBasic().apply{setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)}.toBundle()else null
        val lock = PendingIntent.getActivity(c, 0,
          Intent(c, LockEnforcerActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP).setData(Uri.parse("salahguard://lock/" + Uri.encode(r.getString("id"))))
            .putExtra("payload", r.toString()), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,options)
        builder.setFullScreenIntent(lock, true)
        ReminderDiagnostics.record(c,"full_screen_attached")
      } else ReminderDiagnostics.record(c,"full_screen_permission_blocked")
    }
    try {
      if (manager.activeNotifications.size >= 40)
        manager.activeNotifications.minByOrNull { it.postTime }?.let { manager.cancel(it.id) }
      NotificationManagerCompat.from(c)
        .notify(
          (if (r.getString("route").startsWith("prayer:")) r.getString("route")
            else r.getString("id"))
            .hashCode(),
          builder.build(),
        )
    } catch (error: SecurityException) { ReminderDiagnostics.record(c,"notification_security_blocked");android.util.Log.w("DeenPath", "Notification permission unavailable", error);return }
    ReminderDiagnostics.record(c,"notification_posted_locked_"+locked+"_interactive_"+interactive)
    if (!locked && interactive && (r.optString("route").startsWith("prayer:") || r.optString("route")=="private" || r.optBoolean("testOverlay")))
      OverlayReminderService.tryShow(c, r)
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(c: Context, intent: Intent) {
    if (intent.action == "org.salahguard.app.DISPATCH") {
      val pending = goAsync()
      val wake = (c.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager)
        .newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "DeenPath:reminder")
      wake.acquire(10000)
      Thread {
        try {
          ReminderScheduler.dispatch(c)
        } catch (error: Exception) {
          android.util.Log.e("DeenPath", "Alarm dispatch failed", error)
        } finally {
          if (wake.isHeld) wake.release()
          pending.finish()
        }
      }
        .start()
      return
    }
    val raw = intent.getStringExtra("payload") ?: return
    val pending = goAsync()
    Thread {
      try {
        val r = JSONObject(raw)
        val action = intent.action?.removePrefix("org.salahguard.app.ACTION_")
        val typed = PrayerAction.entries.find { it.name == action }
        if (typed != null) PrayerActions.dispatch(c, r, typed)
        else if (intent.action == "snooze") { /* Old release intents cannot write records. */ }
        else ReminderScheduler.show(c, r)
      } catch (error: Exception) { android.util.Log.w("DeenPath", "Reminder action rejected", error) }
      finally { pending.finish() }
    }.start()
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(c: Context, intent: Intent) {
    if (
      intent.action !in
        listOf(
          Intent.ACTION_BOOT_COMPLETED,
          Intent.ACTION_MY_PACKAGE_REPLACED,
          Intent.ACTION_TIME_CHANGED,
          Intent.ACTION_TIMEZONE_CHANGED,
          AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
        )
    )
      return
    val pending=goAsync()
    val wake=(c.getSystemService(Context.POWER_SERVICE)as android.os.PowerManager).newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK,"DeenPath:restore");wake.acquire(10000)
    Thread{try{if(intent.action==Intent.ACTION_MY_PACKAGE_REPLACED)ReminderScheduler.cancelTests(c);ReminderScheduler.dispatch(c);ReminderScheduler.rebuild(c);TimedEnforcerService.reconcile(c);ReminderDiagnostics.record(c,"reminders_restored")}catch(error:Exception){
      WorkManager.getInstance(c).enqueueUniqueWork("salahguard.restore",ExistingWorkPolicy.REPLACE,OneTimeWorkRequestBuilder<ReminderWorker>().build())
    }finally{if(wake.isHeld)wake.release();pending.finish()}}.start()
  }
}

class ReminderWorker(c: Context, p: WorkerParameters) : Worker(c, p) {
  override fun doWork(): Result =
    try {
      ReminderScheduler.dispatch(applicationContext)
      ReminderScheduler.rebuild(applicationContext)
      WidgetUpdates.request(applicationContext)
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
}
