package org.salahguard.app

import android.Manifest
import android.app.NotificationManager
import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import com.getcapacitor.*
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@CapacitorPlugin(
  name = "SalahNative",
  permissions =
    [
      Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
      Permission(
        alias = "location",
        strings =
          [Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION],
      ),
    ],
)
class SalahNativePlugin : Plugin() {
  private var narrator: StoryNarrator? = null
  private val changed =
    object : BroadcastReceiver() {
      override fun onReceive(c: Context, i: Intent) {
        notifyListeners("storeChanged", JSObject().apply{i.getStringExtra("handledRoute")?.let{put("handledRoute",it)}})
      }
    }

  override fun handleOnDestroy() {
    narrator?.release(); narrator=null
    runCatching { context.unregisterReceiver(changed) }
    super.handleOnDestroy()
  }

  private lateinit var database: LocalDatabase
  private val executor = Executors.newFixedThreadPool(3)

  override fun load() {
    database = LocalDatabase(context)
    ContextCompat.registerReceiver(
      context,
      changed,
      IntentFilter(NativeSignals.STORE_CHANGED),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    BackgroundSync.periodic(context)
    ReminderScheduler.channels(context)
    executor.execute {
      runCatching {
        ReminderScheduler.migrateLegacy(context)
        ReminderScheduler.rebuild(context)
      }
    }
    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork(
        "salahguard.reminders",
        ExistingPeriodicWorkPolicy.UPDATE,
        PeriodicWorkRequestBuilder<ReminderWorker>(15, TimeUnit.MINUTES).build(),
      )
  }

  private fun work(call: PluginCall, fn: () -> JSObject?) {
    executor.execute {
      try {
        call.resolve(fn())
      } catch (e: Exception) {
        call.reject(e.message ?: "Native operation failed", e)
      }
    }
  }

  override fun handleOnResume() {
    super.handleOnResume()
    narrator?.resumed()
    executor.execute { runCatching { TimedEnforcerService.reconcile(context) } }
  }

  override fun handleOnPause() {
    narrator?.pause()
    executor.execute { runCatching { ReminderScheduler.armNext(context) } }
    DeenPrivacy.lock()
    stopHeading()
    super.handleOnPause()
  }

  private var headingListener: android.hardware.SensorEventListener? = null

  private fun stopHeading() {
    headingListener?.let {
      (context.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager)
        .unregisterListener(it)
    }
    headingListener = null
  }

  @PluginMethod
  fun deen(call: PluginCall) {
    if(call.getString("op")=="narration"){
      activity.runOnUiThread {try{
        val reader=narrator?:StoryNarrator(activity){event->notifyListeners("narration",event)}.also{narrator=it}
        val id=call.getString("storyId")?:"";val language=call.getString("language")?:"en"
        val action=call.getString("action")?:"status"
        val text=if(action=="play")LocalDatabase(context).use{db->val root=org.json.JSONObject(db.load());val state=root.optJSONObject("collectibles");require(state?.optJSONObject("copies")?.keys()?.asSequence()?.any{key->val copy=state.getJSONObject("copies").getJSONObject(key);copy.optString("cardId")==id&&!copy.optBoolean("hidden")}==true){"Only owned stories can be narrated"};val metadata=state!!.getJSONObject("library").getJSONObject(id);require(metadata.optString("verification")=="verified");val card=db.cardStory(id)?:metadata;if(language=="ur")card.optString("urdu")else card.optString("english",card.optString("story"))}else ""
        call.resolve(reader.command(action,id,language,text,(call.getDouble("rate",1.0)?:1.0).toFloat()))
      }catch(e:Exception){call.reject(e.message,e)}}
      return
    }
    if(call.getString("op")=="googleSignIn"){GoogleSignIn.begin(activity,call);return}
    if (call.getString("op") == "minimize") {
      activity.runOnUiThread { activity.moveTaskToBack(true); call.resolve() }
      return
    }
    val op = call.getString("op") ?: ""
    if (op == "exportDocument") {
      val value = call.getString("value") ?: ""
      if (value.length > 6 * 1024 * 1024) {
        call.reject("Backup exceeds 6 MiB")
        return
      }
      startActivityForResult(
        call,
        Intent(Intent.ACTION_CREATE_DOCUMENT)
          .addCategory(Intent.CATEGORY_OPENABLE)
          .setType("application/json")
          .putExtra(Intent.EXTRA_TITLE, "DeenPath-private-recovery.json"),
        "exportResult",
      )
      return
    }
    if (op == "privacyScreen") {
      activity.runOnUiThread {
        if (call.getBoolean("enabled", false) == true)
          activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        else activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        call.resolve()
      }
      return
    }
    if (op == "biometric") {
      val biometricScope=LocalDatabase(context).use { SnapshotDocument.owner(it.load()) }
      activity.runOnUiThread {
        val prompt =
          android.hardware.biometrics.BiometricPrompt.Builder(activity)
            .setTitle("DeenPath")
            .setSubtitle("Unlock your private space")
            .setNegativeButton("Cancel", activity.mainExecutor) { _, _ ->
              call.reject("Biometric authentication cancelled")
            }
            .build()
        prompt.authenticate(
          android.os.CancellationSignal(),
          activity.mainExecutor,
          object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(
              result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult
            ) {
              if (LocalDatabase(context).use { SnapshotDocument.owner(it.load()) } != biometricScope) { call.reject("Account changed during authentication"); return }
              DeenPrivacy.allow(context)
              if(call.getBoolean("enable",false)==true) DeenPrivacy.setBiometric(context,true)
              call.resolve()
            }

            override fun onAuthenticationError(code: Int, message: CharSequence) {
              call.reject("Biometrics unavailable or cancelled. Use PIN.")
            }
          },
        )
      }
      return
    }
    if (op == "headingStart") {
      stopHeading()
      val manager =
        context.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager
      val sensor = manager.getDefaultSensor(android.hardware.Sensor.TYPE_ROTATION_VECTOR)
      if (sensor == null) {
        call.resolve(JSObject().put("available", false))
        return
      }
      headingListener =
        object : android.hardware.SensorEventListener {
          override fun onAccuracyChanged(sensor: android.hardware.Sensor?, accuracy: Int) {}

          override fun onSensorChanged(event: android.hardware.SensorEvent) {
            val matrix = FloatArray(9)
            val remapped = FloatArray(9)
            val orientation = FloatArray(3)
            android.hardware.SensorManager.getRotationMatrixFromVector(matrix, event.values)
            @Suppress("DEPRECATION") val rotation = activity.windowManager.defaultDisplay.rotation
            val (axisX, axisY) = HeadingMath.axes(rotation)
            android.hardware.SensorManager.remapCoordinateSystem(matrix, axisX, axisY, remapped)
            android.hardware.SensorManager.getOrientation(remapped, orientation)
            val lat = call.getDouble("lat", 0.0)!!
            val lng = call.getDouble("lng", 0.0)!!
            val declination =
              android.hardware
                .GeomagneticField(lat.toFloat(), lng.toFloat(), 0f, System.currentTimeMillis())
                .declination
            notifyListeners(
              "heading",
              JSObject()
                .put(
                  "degrees",
                  HeadingMath.trueNorth(Math.toDegrees(orientation[0].toDouble()), declination.toDouble()),
                )
                .put("accuracy", event.accuracy),
            )
          }
        }
      manager.registerListener(
        headingListener,
        sensor,
        android.hardware.SensorManager.SENSOR_DELAY_UI,
      )
      call.resolve(JSObject().put("available", true))
      return
    }
    work(call) {
      when (op) {
        "celebrate" -> {
          val s = NotificationAudio.settings(context)
          if (s.optBoolean("celebrationSound") && !s.optBoolean("silent")) {
            val sound = NotificationAudio.selection(context, "routine")
            if (sound != "silent") {
              val tone = RingtoneManager.getRingtone(context, Uri.parse(sound))
              tone?.audioAttributes =
                android.media.AudioAttributes.Builder()
                  .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                  .build()
              tone?.play()
              android.os
                .Handler(android.os.Looper.getMainLooper())
                .postDelayed({ tone?.stop() }, 2000)
            }
          }
          null
        }
        "cancelTestReminders" -> { ReminderScheduler.cancelTests(context); null }
        "reminderDiagnostics" -> {
          val event=runCatching { org.json.JSONObject(database.meta("reminder.event:test") ?: "") }.getOrNull()
          JSObject().put("events",ReminderDiagnostics.snapshot(context))
            .put("testActive",event!=null && PrayerActions.active(context,event))
            .put("locked",(context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager).isKeyguardLocked)
            .put("interactive",(context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isInteractive)
            .put("notificationCount",(context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).activeNotifications.size)
        }
        "recordPrayer" -> {
          val key = call.getString("key") ?: error("Select a prayer")
          require(Regex("\\d{4}-\\d{2}-\\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)").matches(key))
          val action = when (call.getString("action")) { "prayed" -> PrayerAction.PRAYED; "qaza" -> PrayerAction.QAZA; else -> error("Invalid completion action") }
          var changed = false
          database.update { root ->
            require(root.optString("owner") == (call.getString("owner") ?: "null")) { "Account changed. Reopen Prayer." }
            val parts = key.split(':')
            val oldRecord = NativeRecords.record(root, "prayer_records", key)
            val old = if (oldRecord != null && !oldRecord.optBoolean("deleted")) oldRecord.optJSONObject("data") else null
            val calculated by lazy { PrayerWindows.calculate(java.time.LocalDate.parse(parts[0]), root.getJSONObject("settings")).first { it.name == parts[1] } }
            val start = old?.optString("windowStart")?.takeIf { it.isNotEmpty() } ?: java.time.Instant.ofEpochMilli(calculated.start).toString()
            val end = old?.optString("windowEnd")?.takeIf { it.isNotEmpty() } ?: java.time.Instant.ofEpochMilli(calculated.end).toString()
            val event = org.json.JSONObject().put("route", "prayer:" + key).put("windowStart", start).put("windowEnd", end)
            changed = PrayerActionRules.apply(root, event, action, java.time.Instant.now())
            root
          }
          if(changed){
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(("prayer:"+key).hashCode())
            NativeSignals.changed(context);ReminderMaintenance.request(context,true)
          }
          JSObject().put("changed", changed)
        }
        "snoozePrayer" -> {
          val route = call.getString("route") ?: error("Select a prayer")
          require(Regex("prayer:\\d{4}-\\d{2}-\\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)").matches(route))
          val raw = database.meta("reminder.event:" + route)
          val event = runCatching { org.json.JSONObject(raw ?: "") }.getOrNull()
          if (event != null && PrayerActions.active(context, event)) PrayerActions.dispatch(context, event, PrayerAction.SNOOZE)
          else {
            val payload = org.json.JSONObject(call.getString("payload") ?: error("Missing prayer"))
            require(payload.optString("route") == route)
            ReminderScheduler.add(context, payload)
          }
          null
        }
        "rebuildReminders" -> {
          ReminderMaintenance.request(context,true)
          JSObject().put("queued",true)
        }
        "headingStop" -> {
          stopHeading()
          null
        }
        "erasePrivate" -> {
          DeenPrivacy.erase(context)
          null
        }
        "cardStories" -> {
          val ids=call.getArray("ids")?:org.json.JSONArray();require(ids.length() in 1..3)
          LocalDatabase(context).use{db->val state=org.json.JSONObject(db.load()).optJSONObject("collectibles")?:CollectibleRules.empty();val allowed=state.getJSONObject("copies").let{copies->copies.keys().asSequence().map{copies.getJSONObject(it).optString("cardId")}.toMutableSet()};state.optJSONObject("reservations")?.let{reservations->reservations.keys().forEach{key->val rows=reservations.getJSONObject(key).getJSONArray("cardIds");for(i in 0 until rows.length())allowed.add(rows.getString(i))}}
            val rows=org.json.JSONArray();for(i in 0 until ids.length()){val id=ids.getString(i);require(id in allowed){"Story is not owned or reserved"};db.cardStory(id)?.let{rows.put(it)}};JSObject().put("cards",rows)
          }
        }
        "reservePack", "openPack", "cacheCardDetails", "purchasePack", "revealCard", "cacheCardLibrary", "cacheCardArtwork" -> {
          LocalDatabase(context).use { db -> db.update { root ->
            require(root.optString("owner").let{if(it=="null")"" else it}==(call.getString("owner")?:"")){"Account changed"}
            when(op){
              "reservePack"->CollectibleRules.reserve(root,call.getString("id")?:"")
              "openPack"->root.optJSONObject("collectibles")?.optJSONObject("packs")?.optJSONObject(call.getString("id")?:"")?.put("opened",true)
              "cacheCardDetails"->{val rows=call.getArray("cards")?:org.json.JSONArray();require(rows.length()<=3);val state=root.optJSONObject("collectibles")?:CollectibleRules.empty();for(i in 0 until rows.length()){val card=rows.getJSONObject(i);require(CollectibleRules.verified(card));state.getJSONObject("library").put(card.getString("id"),card)};root.put("collectibles",state)}
              "purchasePack"->{
                val id=call.getString("id")?:"";val state=root.optJSONObject("collectibles")?:CollectibleRules.empty();val ids=state.optJSONObject("reservations")?.optJSONObject(id)?.optJSONArray("cardIds");if(ids!=null)for(i in 0 until ids.length()){val key=ids.getString(i);val text=db.cardStory(key);val metadata=state.getJSONObject("library").optJSONObject(key);if(text!=null&&metadata!=null){metadata.put("english",text.optString("english")).put("urdu",text.optString("urdu"))}}
                CollectibleRules.purchase(root,id)
              }
              "revealCard"->CollectibleRules.reveal(root,call.getString("copyId")?:"")
              "cacheCardLibrary"->CollectibleRules.cacheLibrary(root,call.getArray("cards")?:org.json.JSONArray(),call.getArray("states")?:org.json.JSONArray())
              "cacheCardArtwork"->{
                val id=call.getString("artId")?:"";require(Regex("[a-f0-9-]{36}").matches(id));val file=safeFile(call.getString("path")?:"")
                val bounds=android.graphics.BitmapFactory.Options().apply{inJustDecodeBounds=true};android.graphics.BitmapFactory.decodeFile(file.path,bounds)
                require(bounds.outWidth in 1..4096&&bounds.outHeight in 1..4096&&file.length()<=8388608){"Invalid artwork file"}
                val state=root.optJSONObject("collectibles")?:CollectibleRules.empty();state.getJSONObject("artwork").put(id,org.json.JSONObject().put("path",file.path).put("mime",bounds.outMimeType).put("bytes",file.length()).put("touched",System.currentTimeMillis()));val art=state.getJSONObject("artwork");var bytes=art.keys().asSequence().sumOf{art.optJSONObject(it)?.optLong("bytes")?:0L};val oldest=art.keys().asSequence().filter{it!=id}.sortedBy{art.getJSONObject(it).optLong("touched")}.toList();for(key in oldest){if(bytes<=64L*1024*1024)break;val entry=art.getJSONObject(key);runCatching{safeFile(entry.getString("path")).delete()};bytes-=entry.optLong("bytes");art.remove(key)};root.put("collectibles",state)
              }
            };root
          }}
          NativeSignals.changed(context);if(op in listOf("purchasePack","revealCard"))BackgroundSync.enqueue(context);JSObject().put("changed",true)
        }
        "purchaseTheme" -> {
          val owner=call.getString("owner")?:""
          LocalDatabase(context).use { db -> db.update { root ->
            require(root.optString("owner").let{if(it=="null")"" else it}==owner){"Account changed"}
            ThemeRules.purchase(root,call.getString("id")?:"",call.getString("kind")?:"",call.getObject("payload")?:JSObject());root
          }}
          NativeSignals.changed(context);BackgroundSync.enqueue(context);JSObject().put("changed",true)
        }
        "completeCharityPenalty" -> JSObject().put("changed",SecretActions.completeCharity(context,call.getString("owner")?:"",call.getString("id")?:""))
        "secretCheckin" -> JSObject().put("changed",SecretActions.answer(context,call.getString("owner")?:"",call.getString("habitId")?:"",call.getString("day")?:"",call.getString("state")?:""))
        "pdfPreview" -> {
          val file=safeFile(call.getString("path")?:"")
          android.os.ParcelFileDescriptor.open(file,android.os.ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            android.graphics.pdf.PdfRenderer(descriptor).use { renderer ->
              val index=(call.getInt("page",0)?:0).coerceIn(0,maxOf(0,renderer.pageCount-1))
              renderer.openPage(index).use { page ->
                val scale=minOf(600f/page.width,900f/page.height)
                val bitmap=android.graphics.Bitmap.createBitmap(maxOf(1,(page.width*scale).toInt()),maxOf(1,(page.height*scale).toInt()),android.graphics.Bitmap.Config.ARGB_8888)
                try {bitmap.eraseColor(android.graphics.Color.WHITE);page.render(bitmap,null,android.graphics.Matrix().apply{postScale(scale,scale)},android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);val bytes=java.io.ByteArrayOutputStream();bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,bytes);JSObject().put("pages",renderer.pageCount).put("base64",android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP))} finally {bitmap.recycle()}
              }
            }
          }
        }
        "privacyStatus" -> JSObject(DeenPrivacy.status(context).toString())
        "unlock" -> {
          DeenPrivacy.unlock(context, call.getString("pin") ?: "")
          null
        }
        "lock" -> {
          DeenPrivacy.lock()
          null
        }
        "disableBiometric" -> { DeenPrivacy.setBiometric(context,false); null }
        "setPin" -> {
          DeenPrivacy.setPin(context, call.getString("pin") ?: "")
          null
        }
        "seal" -> JSObject().put("value", DeenPrivacy.seal(context, call.getString("value") ?: ""))
        "open" -> JSObject().put("value", DeenPrivacy.open(context, call.getString("value") ?: ""))
        "backupKey" ->
          JSObject().put("value", DeenPrivacy.backup(context, call.getString("password") ?: ""))
        "restoreKey" -> {
          DeenPrivacy.restore(
            context,
            call.getString("password") ?: "",
            call.getString("value") ?: "",
          )
          null
        }
        "localChatRead" -> {
          require(DeenPrivacy.status(context).optBoolean("unlocked")) { "Protection is locked" }
          JSObject()
            .put(
              "value",
              SecureVault(
                  context,
                  "deen.chats." + SnapshotDocument.owner(database.load()),
                )
                .get(),
            )
        }
        "localChatWrite" -> {
          require(DeenPrivacy.status(context).optBoolean("unlocked")) { "Protection is locked" }
          SecureVault(
              context,
              "deen.chats." + SnapshotDocument.owner(database.load()),
            )
            .set(call.getString("value") ?: "")
          null
        }
        "providerStatus" -> JSObject(GuidanceClient.status(context).toString())
        "providerConfigure" -> {
          GuidanceClient.configure(
            context,
            call.getString("which") ?: "gemini",
            call.getString("key") ?: "",
            call.getString("model") ?: "gemini-3.8-flash",
          )
          null
        }
        "guidance" ->
          JSObject(
            GuidanceClient.request(
                context,
                call.getString("which") ?: "gemini",
                call.getArray("messages") ?: org.json.JSONArray(),
              )
              .toString()
          )
        else -> throw IllegalArgumentException("Unsupported operation")
      }
    }
  }

  @ActivityCallback
  private fun exportResult(call: PluginCall?, result: ActivityResult) {
    if (call == null) return
    if (result.resultCode != android.app.Activity.RESULT_OK) {
      call.resolve(JSObject().put("cancelled", true))
      return
    }
    work(call) {
      val uri = result.data?.data ?: error("No document selected")
      context.contentResolver.openOutputStream(uri, "wt")!!.use {
        it.write((call.getString("value") ?: "").toByteArray(Charsets.UTF_8))
      }
      JSObject().put("saved", true)
    }
  }

  @PluginMethod fun load(call: PluginCall) = work(call) { JSObject().put("value", database.load()) }

  @PluginMethod
  fun save(call: PluginCall) =
    work(call) {
      val previous=runCatching{org.json.JSONObject(database.load())}.getOrDefault(org.json.JSONObject())
      val incoming = org.json.JSONObject(call.getString("value") ?: "{}")
      DeenPrivacy.adopt(context, incoming.optString("owner"))
      val root =
        database.mergeSave(
          call.getString("value") ?: error("Missing snapshot"),
          call.getString("base") ?: "",
        )
      DeenPrivacy.finishAdopt(context)
      ReminderMaintenance.request(context,ReminderMaintenance.planKey(previous)!=ReminderMaintenance.planKey(root))
      JSObject().put("value", root.toString())
    }

  @PluginMethod
  fun sync(call: PluginCall) =
    work(call) {
      try {
        val root = SyncEngine.run(context, call.getBoolean("force", false) == true)
        JSObject().put("value", root.toString())
      } finally {
        notifyListeners("storeChanged", JSObject())
      }
    }

  @PluginMethod
  fun testReminder(call: PluginCall) =
    work(call) {
      ReminderScheduler.channels(context)
      val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
      val exact =
        Build.VERSION.SDK_INT < 31 ||
          (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
      val root = runCatching {
        org.json.JSONObject(database.load())
      }
        .getOrDefault(org.json.JSONObject())
      val settings = root.optJSONObject("settings") ?: org.json.JSONObject()
      val overlay = call.getBoolean("overlay", false) == true && Settings.canDrawOverlays(context)
      val channelEnabled =
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
          .getNotificationChannel(
            NotificationAudio.ensure(
              context,
              "gentle",
              settings.optBoolean("silent"),
              settings.optBoolean("vibration", true),
            )
          )
          ?.importance != android.app.NotificationManager.IMPORTANCE_NONE
      val at = System.currentTimeMillis() + 15000
      val scheduled = (enabled && channelEnabled) || overlay
      if (scheduled) {
        ReminderScheduler.cancelTests(context)
        val lang = settings.optString("lang", "en")
        val title =
          when (lang) {
            "ur" -> "صلاح گارڈ کی آزمائشی یاد دہانی"
            "ar" -> "تذكير صلاح غارد التجريبي"
            else -> "DeenPath test reminder"
          }
        val preview=runCatching {
          val day=java.time.LocalDate.now(java.time.ZoneId.of(settings.getString("timezone")))
          val windows=(-1L..1L).flatMap { PrayerWindows.calculate(day.plusDays(it),settings) }.sortedBy { it.start }
          val now=System.currentTimeMillis()
          windows.firstOrNull { now>=it.start && now<it.end } ?: windows.firstOrNull { it.start>now }
        }.getOrNull()
        ReminderScheduler.add(
          context,
          org.json
            .JSONObject()
            .put("id", (if (overlay) "test:overlay:" else "test:notification:") + UUID.randomUUID())
            .put("at", at)
            .put("title", title)
            .put("body", NativeContent.reminder(context, "20:14", NativeContent.language(settings)))
            .put("route", "test")
            .put("category", "gentle")
            .put("testOverlay", overlay)
            .put("testSecrets",call.getBoolean("secrets",false)==true)
            .apply { preview?.let { window ->
              put("testPrayer",if(window.name=="Dhuhr" && window.day.dayOfWeek==java.time.DayOfWeek.FRIDAY) "Jummah" else window.name)
              put("windowStart",java.time.Instant.ofEpochMilli(window.start).toString())
              put("windowEnd",java.time.Instant.ofEpochMilli(window.end).toString())
            } }
            .put("lang", lang)
            .put("silent", settings.optBoolean("silent"))
            .put("vibration", settings.optBoolean("vibration", true)),
        )
      }
      if (scheduled)
        android.os
          .Handler(android.os.Looper.getMainLooper())
          .postDelayed(
            {
              executor.execute { runCatching { ReminderScheduler.dispatch(context) } }
            },
            15500,
          )
      JSObject()
        .put(
          "muted",
          settings.optBoolean("silent") ||
            (context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager)
              .getStreamVolume(android.media.AudioManager.STREAM_ALARM) == 0 ||
            NotificationAudio.selection(context, "gentle") == "silent",
        )
        .put("scheduled", scheduled)
        .put("at", at)
        .put("exact", exact)
        .put("notifications", enabled)
        .put("channelEnabled", channelEnabled)
        .put("overlay", overlay)
    }

  @PluginMethod
  fun vaultGet(call: PluginCall) =
    work(call) { JSObject().put("value", SecureVault(context).get()) }

  @PluginMethod
  fun vaultSet(call: PluginCall) =
    work(call) {
      synchronized(LocalDatabase.snapshotLock) {
        SecureVault(context).set(call.getString("value") ?: "")
        WidgetUpdates.update(context)
      }
      null
    }

  @PluginMethod
  fun pickSound(call: PluginCall) {
    val category = call.getString("category") ?: "default"
    val existing = NotificationAudio.selection(context, category)
    val intent =
      Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
        .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION)
        .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
        .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
        .putExtra(
          RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,
          if (existing == "silent") null as Uri? else Uri.parse(existing),
        )
        .putExtra(
          RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI,
          Settings.System.DEFAULT_NOTIFICATION_URI,
        )
    startActivityForResult(call, intent, "soundResult")
  }

  @ActivityCallback
  private fun soundResult(call: PluginCall?, result: ActivityResult) {
    if (call == null) return
    if (result.resultCode != android.app.Activity.RESULT_OK) {
      call.resolve(JSObject().put("cancelled", true))
      return
    }
    @Suppress("DEPRECATION")
    val uri = result.data?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
    if (uri != null)
      runCatching {
        context.contentResolver.takePersistableUriPermission(
          uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      }
    val name =
      if (uri == null) "Silent"
      else
        runCatching { RingtoneManager.getRingtone(context, uri)?.getTitle(context) }.getOrNull()
          ?: "System notification sound"
    call.resolve(JSObject().put("uri", uri?.toString() ?: "silent").put("name", name))
  }

  @PluginMethod
  fun permissions(call: PluginCall) {
    call.resolve(
      JSObject()
        .put("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
        .put(
          "exact",
          Build.VERSION.SDK_INT < 31 ||
            (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager)
              .canScheduleExactAlarms(),
        )
        .put("overlay", Settings.canDrawOverlays(context))
        .put("reminderServiceRunning", TimedEnforcerService.running)
        .put("batteryUnrestricted",(context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isIgnoringBatteryOptimizations(context.packageName))
        .put("fullScreen", Build.VERSION.SDK_INT < 34 || (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent())
    )
  }

  @PluginMethod
  fun requestNotifications(call: PluginCall) {
    if (
      Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED
    )
      requestPermissionForAlias("notifications", call, "notificationResult")
    else call.resolve()
  }

  @PermissionCallback
  private fun notificationResult(call: PluginCall) {
    call.resolve()
  }

  @PluginMethod
  fun openSettings(call: PluginCall) {
    val kind = call.getString("kind") ?: ""
    val intent =
      if (kind.startsWith("channel:")) {
        val raw = database.load()
        val settings =
          if (raw.isEmpty()) org.json.JSONObject()
          else org.json.JSONObject(raw).getJSONObject("settings")
        val id =
          NotificationAudio.ensure(
            context,
            kind.substringAfter(':'),
            settings.optBoolean("silent"),
            settings.optBoolean("vibration", true),
          )
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .putExtra(Settings.EXTRA_CHANNEL_ID, id)
      } else
        when (kind) {
          "exact" ->
            if (Build.VERSION.SDK_INT >= 31)
              Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + context.packageName),
              )
            else
              Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.packageName),
              )
          "fullscreen" -> if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + context.packageName)) else Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          "battery" -> if(!(context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager).isIgnoringBatteryOptimizations(context.packageName))Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,Uri.parse("package:"+context.packageName)) else Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          "overlay" ->
            Intent(
              Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
              Uri.parse("package:" + context.packageName),
            )
          else ->
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
    activity.startActivity(intent)
    call.resolve()
  }

  @PluginMethod
  fun schedule(call: PluginCall) =
    work(call) {
      val reminders = call.getArray("reminders") ?: error("Missing reminders")
      ReminderScheduler.plan(
        context,
        (0 until reminders.length()).map { reminders.getJSONObject(it) },
        call.getBoolean("replace", false) == true,
      )
      JSObject()
        .put(
          "exact",
          Build.VERSION.SDK_INT < 31 ||
            (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager)
              .canScheduleExactAlarms(),
        )
    }

  @PluginMethod
  fun locate(call: PluginCall) {
    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED
    ) {
      requestPermissionForAlias("location", call, "locationResult")
      return
    }
    locationResult(call)
  }

  @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
  @PermissionCallback
  private fun locationResult(call: PluginCall) {
    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED
    ) {
      call.reject("Location permission denied")
      return
    }
    LocationFix.locate(context,call)
  }

  private fun safeFile(path: String): File {
    val base = File(context.filesDir, "documents").apply { mkdirs() }.canonicalFile
    val file = File(path).canonicalFile
    require(file.parentFile == base) { "Invalid private file path" }
    return file
  }

  @PluginMethod
  fun storeFile(call: PluginCall) =
    work(call) {
      val bytes = Base64.decode(call.getString("base64") ?: "", Base64.DEFAULT)
      require(bytes.size <= 8 * 1024 * 1024) { "Maximum file size is 8 MiB" }
      val dir = File(context.filesDir, "documents").apply { mkdirs() }
      val f = File(dir, UUID.randomUUID().toString())
      f.writeBytes(bytes)
      JSObject().put("path", f.absolutePath)
    }

  @PluginMethod
  fun readFile(call: PluginCall) =
    work(call) {
      JSObject()
        .put(
          "base64",
          Base64.encodeToString(safeFile(call.getString("path") ?: "").readBytes(), Base64.NO_WRAP),
        )
    }

  @PluginMethod
  fun removeFile(call: PluginCall) =
    work(call) {
      safeFile(call.getString("path") ?: "").delete()
      null
    }

  @PluginMethod
  fun viewFile(call: PluginCall) {
    try {
      val path = safeFile(call.getString("path") ?: "").path
      activity.startActivity(
        Intent(activity, PdfActivity::class.java)
          .putExtra("path", path)
          .putExtra("page", call.getInt("page", 0))
          .putExtra("routineId", call.getString("routineId"))
      )
      call.resolve()
    } catch (e: Exception) {
      call.reject(e.message)
    }
  }

  @PluginMethod
  fun filePosition(call: PluginCall) =
    work(call) { JSObject().put("page", database.position(call.getString("path") ?: "")) }

  @PluginMethod
  fun storage(call: PluginCall) =
    work(call) {
      JSObject()
        .put(
          "bytes",
          context.filesDir.walkTopDown().filter { it.isFile }.sumOf { it.length() } +
            context.getDatabasePath("salahguard.db").length(),
        )
    }
}
