package org.salahguard.app

import java.time.*
import java.time.temporal.*
import org.json.JSONObject
import org.json.JSONArray

object RoutinePeriods {
  private val cache=linkedMapOf<String,List<NativePrayerStart>>()
  @Synchronized fun starts(r:JSONObject,day:LocalDate):List<NativePrayerStart> {
    if(day<LocalDate.parse(r.getString("startDate")) || (r.optString("endDate").isNotEmpty() && day>LocalDate.parse(r.getString("endDate"))))return emptyList()
    val settings=r.getJSONObject("resetSettings")
    val key=day.toString()+settings.toString()
    val windows=cache[key] ?: PrayerWindows.starts(day,settings).also {if(cache.size>=256)cache.clear();cache[key]=it}
    val selected=r.optJSONArray("resetPrayers") ?: JSONArray()
    val names=(0 until selected.length()).map {selected.getString(it)}.toSet()
    return windows.filter {it.name in names}
  }
  fun next(r:JSONObject,instant:Instant=Instant.now()):Long? {
    val day=maxOf(instant.atZone(ZoneId.of(r.getString("timezone"))).toLocalDate(),LocalDate.parse(r.getString("startDate")))
    return listOf(day,day.plusDays(1)).flatMap {starts(r,it)}.filter {it.start>instant.toEpochMilli()}.minOfOrNull {it.start}
  }
  fun key(r: JSONObject, instant: Instant = Instant.now(), records: JSONArray = JSONArray()): String {
    if (r.optString("frequency") == "after_prayer") {
      var anchor=instant.atZone(ZoneId.of(r.getString("timezone"))).toLocalDate()
      if(r.optString("endDate").isNotEmpty()) anchor=minOf(anchor,LocalDate.parse(r.getString("endDate")))
      val candidates=listOf(anchor.minusDays(1),anchor).flatMap { starts(r,it) }.filter { it.start<=instant.toEpochMilli() }.sortedBy { it.start }
      return candidates.lastOrNull()?.id ?: r.getString("startDate")+":start"
    }
    val time = instant.atZone(ZoneId.of(r.getString("timezone")))
    var date = time.toLocalDate()
    if (
      r.optString("frequency") == "daily" &&
        time.toLocalTime() < LocalTime.parse(r.optString("deadline", "00:00"))
    )
      date = date.minusDays(1)
    if (r.optString("calendar") == "hijri") return date.toString()
    return when (r.optString("frequency")) {
      "unscheduled" -> "lifetime"
      "weekly" -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()
      "monthly" -> date.toString().take(7)
      "yearly" -> date.year.toString()
      "interval" ->
        r.getString("startDate") +
          ":" +
          (ChronoUnit.DAYS.between(LocalDate.parse(r.getString("startDate")), date) /
            maxOf(1, r.optInt("interval", 1)))
      else -> date.toString()
    }
  }
}
