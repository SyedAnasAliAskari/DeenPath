package org.salahguard.app

import android.content.Context
import android.app.NotificationManager
import java.time.Instant
import org.json.JSONObject

/** Only explicit completion actions may mutate worship records. Tested without Android. */
enum class PrayerAction { PRAYED, QAZA, SNOOZE, CLOSE }
object PrayerActionRules {
  private val route = Regex("prayer:(\\d{4}-\\d{2}-\\d{2}):(Fajr|Dhuhr|Asr|Maghrib|Isha)")
  fun apply(root: JSONObject, event: JSONObject, action: PrayerAction, now: Instant): Boolean {
    if (action == PrayerAction.SNOOZE || action == PrayerAction.CLOSE) return false
    val match = route.matchEntire(event.optString("route")) ?: error("Select a prayer in DeenPath")
    val day = match.groupValues[1]
    val prayer = match.groupValues[2]
    val id = "$day:$prayer"
    val record = NativeRecords.record(root, "prayer_records", id)
    val old = if (record != null && !record.optBoolean("deleted")) record.optJSONObject("data") ?: JSONObject() else JSONObject()
    val start = Instant.parse(if (old.optString("windowStart").isNotEmpty()) old.getString("windowStart") else event.getString("windowStart"))
    val end = Instant.parse(if (old.optString("windowEnd").isNotEmpty()) old.getString("windowEnd") else event.getString("windowEnd"))
    require(end > start) { "Prayer ending time unavailable" }
    if (old.optString("status") == "na") return false
    if (!old.isNull("qazaAt") && old.optString("qazaAt").isNotEmpty()) return false
    val completed = runCatching { Instant.parse(old.getString("completedAt")) }.getOrNull()
    val oldStart = runCatching { Instant.parse(old.getString("windowStart")) }.getOrDefault(start)
    val oldEnd = runCatching { Instant.parse(old.getString("windowEnd")) }.getOrDefault(end)
    if (completed != null && completed >= oldStart && completed < oldEnd) return false
    if (action == PrayerAction.PRAYED) require(now >= start && now < end) { "Prayer window is not open. Open Prayer to record Qaza." }
    if (action == PrayerAction.QAZA) require(now >= end) { "Prayer window has not ended" }
    val data = JSONObject(old.toString()).put("day", day).put("prayer", prayer)
      .put("windowStart", start.toString()).put("windowEnd", end.toString())
      .put("timezone", old.optString("timezone").ifEmpty { root.getJSONObject("settings").getString("timezone") })
    if (action == PrayerAction.QAZA) {
      data.remove("completedAt")
      data.put("qazaAt", now.toString())
      NativeRecords.put(root, "qaza_records", id, JSONObject().put("day", day).put("prayer", prayer).put("qazaAt", now.toString()))
    } else {
      data.remove("qazaAt")
      data.remove("status")
      data.put("completedAt", now.toString())
    }
    NativeRecords.put(root, "prayer_records", id, data)
    return true
  }
}

object ReminderEventRules {
  fun active(stored: JSONObject?, incoming: JSONObject, owner: String): Boolean = stored != null &&
    !stored.optBoolean("handled") && stored.optString("id").isNotEmpty() && stored.optString("id") == incoming.optString("id") &&
    stored.optString("owner") == owner && incoming.optString("owner") == owner
}
object PrayerActions {
  private fun completed(root: JSONObject, event: JSONObject): Boolean {
    if(event.optString("route")=="private") return root.optJSONObject("settings")?.optString("privateCheckinDoneDay")==event.optString("checkinDay") && event.optString("checkinDay").isNotEmpty()
    if (!event.optString("route").startsWith("prayer:")) return false
    val record = NativeRecords.record(root, "prayer_records", event.optString("route").substringAfter(':')) ?: return false
    if (record.optBoolean("deleted")) return false
    val data = record.getJSONObject("data")
    if (data.optString("status") == "na" || !data.isNull("qazaAt") && data.optString("qazaAt").isNotEmpty()) return true
    return runCatching {
      val at = Instant.parse(data.getString("completedAt"))
      val start = Instant.parse(data.optString("windowStart").ifEmpty { event.getString("windowStart") })
      val end = Instant.parse(data.optString("windowEnd").ifEmpty { event.getString("windowEnd") })
      at >= start && at < end
    }.getOrDefault(false)
  }
  private fun key(r: JSONObject) = "reminder.event:" + r.optString("route")
  fun activate(c: Context, r: JSONObject): Boolean = synchronized(LocalDatabase.snapshotLock) {
    LocalDatabase(c).use { db ->
      val root = JSONObject(db.load().ifEmpty { "{}" })
      val owner = root.optString("owner")
      val settings = root.optJSONObject("settings") ?: JSONObject()
      if (!PrayerReminderRules.eventInWindow(r,System.currentTimeMillis()) || !ReminderConfiguration.matches(r, settings) || completed(root, r)) return@use false
      if (r.has("owner") && r.optString("owner") != owner) return@use false
      val previous = runCatching { JSONObject(db.meta(key(r)) ?: "") }.getOrNull()
      if (previous?.optString("owner") == owner &&
        (previous.optLong("at") > r.optLong("at") || previous.optString("id") == r.optString("id") && previous.optBoolean("handled"))) return@use false
      r.remove("handled")
      r.put("owner", owner)
      if (r.optString("route").startsWith("prayer:")) r.put("calculation", ReminderConfiguration.key(settings))
      db.meta(key(r), r.toString())
      true
    }
  }
  fun active(c: Context, r: JSONObject): Boolean = synchronized(LocalDatabase.snapshotLock) {
    LocalDatabase(c).use { db ->
      val root = JSONObject(db.load().ifEmpty { "{}" })
      val event = runCatching { JSONObject(db.meta(key(r)) ?: "") }.getOrNull()
      PrayerReminderRules.eventInWindow(r,System.currentTimeMillis()) && ReminderEventRules.active(event, r, root.optString("owner")) &&
        ReminderConfiguration.matches(event!!, root.optJSONObject("settings") ?: JSONObject()) && !completed(root, r)
    }
  }
  private data class Outcome(val changed: Boolean, val snoozed: Boolean,val gems:Int)

  fun dispatch(c: Context, r: JSONObject, action: PrayerAction): Boolean {
    val outcome = ReminderActionExecution.run(LocalDatabase.snapshotLock, prepare = {
      LocalDatabase(c).use { db ->
        val root = JSONObject(db.load().ifEmpty { "{}" })
        val event = runCatching { JSONObject(db.meta(key(r)) ?: "") }.getOrNull()
        if (!ReminderEventRules.active(event, r, root.optString("owner")) ||
          !ReminderConfiguration.matches(event!!, root.optJSONObject("settings") ?: JSONObject()) || completed(root, r)) return@use null
        var changed = false
        var gems=0
        val storage = db.writableDatabase
        storage.beginTransaction()
        try {
          if (action == PrayerAction.PRAYED || action == PrayerAction.QAZA) {
            db.update { state -> val before=state.optJSONObject("economy")?.let{JSONObject(it.toString())};changed = PrayerActionRules.apply(state, r, action, Instant.now());GemRules.reconcile(state);if(changed)gems=CompletionRewards.earned(before,state.optJSONObject("economy"),r.optString("route"));state }
          }
          if (action == PrayerAction.CLOSE) db.meta("reminder.lastClose", System.currentTimeMillis().toString())
          if (action == PrayerAction.SNOOZE) {
            val next = JSONObject(r.toString())
              .put("id", r.optString("route") + ":snooze:" + java.util.UUID.nameUUIDFromBytes(r.getString("id").toByteArray()))
              .put("at", System.currentTimeMillis() + (root.optJSONObject("settings")?.optInt("snoozeMinutes", 10) ?: 10).coerceIn(1, 60) * 60000L)
            if(PrayerReminderRules.eventInWindow(next,next.getLong("at"))) db.putReminder(next)
            db.meta("reminder.snooze:"+r.optString("route"),next.getLong("at").toString())
          }
          db.meta(key(r), JSONObject(r.toString()).put("handled", true).toString())
          storage.setTransactionSuccessful()
        } finally { storage.endTransaction() }
        Outcome(changed, action == PrayerAction.SNOOZE,gems)
      }
    }, finish = { prepared ->
      if (prepared != null) {
        val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(r.optString("route").hashCode())
        manager.cancel(r.optString("id").hashCode())
        NativeSignals.changed(c,r.optString("route"))
        OverlayReminderService.refresh(c)
        if (prepared.snoozed) ReminderScheduler.armNext(c)
        if (prepared.changed) {
          android.os.Handler(android.os.Looper.getMainLooper()).post {android.widget.Toast.makeText(c,CompletionRewards.receipt(if(action==PrayerAction.QAZA)"Qaza" else r.optString("route").substringAfterLast(':'),prepared.gems),android.widget.Toast.LENGTH_LONG).show()}
          ReminderMaintenance.request(c,true)
        }
      }
    })
    return outcome != null
  }
}
