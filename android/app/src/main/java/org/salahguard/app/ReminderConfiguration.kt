package org.salahguard.app

import org.json.JSONArray
import org.json.JSONObject

/** Only calculation inputs invalidate prayer events; sound/language changes do not. */
object ReminderConfiguration {
  fun key(settings: JSONObject): String = JSONArray()
    .put(settings.optDouble("lat", 24.8607)).put(settings.optDouble("lng", 67.0011))
    .put(settings.optString("timezone", "Asia/Karachi"))
    .put(settings.optString("method", "Karachi")).put(settings.optBoolean("hanafi", true))
    .put(settings.optJSONArray("adjustments") ?: JSONArray("[0,0,0,0,0]"))
    .put(settings.optString("ishaEnd", "midnight")).toString()

  fun eventId(base: String, owner: String, settings: JSONObject): String =
    base + ":" + java.util.UUID.nameUUIDFromBytes((owner + ":" + key(settings)).toByteArray())

  fun matches(event: JSONObject, settings: JSONObject): Boolean =
    !event.optString("route").startsWith("prayer:") || !event.has("calculation") ||
      event.optString("calculation") == key(settings)
}

/** Native alarm delivery takes the scheduler monitor before the snapshot monitor.
 * Action side effects must run AFTER releasing the snapshot monitor to avoid inversion. */
object ReminderActionExecution {
  fun <T> run(lock: Any, prepare: () -> T, finish: (T) -> Unit): T {
    val prepared = synchronized(lock) { prepare() }
    finish(prepared)
    return prepared
  }
}
