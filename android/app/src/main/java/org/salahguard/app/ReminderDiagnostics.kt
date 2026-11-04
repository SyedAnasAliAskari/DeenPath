package org.salahguard.app
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
/** Bounded delivery stages; no worship text, account identifiers or credentials. */
object ReminderDiagnostics {
 @Synchronized fun record(c:Context,stage:String) {
  val prefs=c.getSharedPreferences("reminder-diagnostics",0)
  val old=runCatching { JSONArray(prefs.getString("events","[]")) }.getOrDefault(JSONArray())
  val next=JSONArray()
  for(i in maxOf(0,old.length()-19) until old.length()) next.put(old.getJSONObject(i))
  next.put(JSONObject().put("at",System.currentTimeMillis()).put("stage",stage))
  prefs.edit().putString("events",next.toString()).apply()
  android.util.Log.i("DeenPath",stage)
 }
 fun snapshot(c:Context):JSONArray=runCatching { JSONArray(c.getSharedPreferences("reminder-diagnostics",0).getString("events","[]")) }.getOrDefault(JSONArray())
}
