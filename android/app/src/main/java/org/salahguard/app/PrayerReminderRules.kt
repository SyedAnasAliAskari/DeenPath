package org.salahguard.app
import org.json.JSONObject
import java.time.*

/** Reminders belong only to an open prayer window. Qaza remains a manual backlog. */
object PrayerReminderRules {
 fun eventInWindow(event:JSONObject,now:Long):Boolean {
  val route=event.optString("route")
  if(route.startsWith("qaza:") || event.optString("category")=="qaza")return false
  if(!route.startsWith("prayer:"))return true
  return runCatching { now>=Instant.parse(event.getString("windowStart")).toEpochMilli() && now<Instant.parse(event.getString("windowEnd")).toEpochMilli() }.getOrDefault(false)
 }
 fun pending(root:JSONObject,route:String,now:Long):Boolean=runCatching {
  val s=root.getJSONObject("settings");if(!s.optBoolean("enforcer"))return@runCatching false
  val key=route.removePrefix("prayer:");val parts=key.split(':');if(parts.size!=2)return@runCatching false
  val row=NativeRecords.record(root,"prayer_records",key)
  val data=if(row!=null&&!row.optBoolean("deleted"))row.optJSONObject("data")else null
  if(data!=null&&(data.optString("status")=="na"||!data.isNull("qazaAt")&&data.optString("qazaAt").isNotEmpty()))return@runCatching false
  val calculated=PrayerWindows.calculate(LocalDate.parse(parts[0]),s).firstOrNull{it.name==parts[1]}?:return@runCatching false
  val window=PrayerWindows.recorded(calculated,data)
  if(now<window.start||now>=window.end)return@runCatching false
  val completed=data?.let{runCatching{Instant.parse(it.getString("completedAt")).toEpochMilli()}.getOrNull()}
  completed==null||completed<window.start||completed>=window.end
 }.getOrDefault(false)
}
