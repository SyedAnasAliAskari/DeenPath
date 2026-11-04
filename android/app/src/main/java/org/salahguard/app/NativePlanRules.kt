package org.salahguard.app

import java.time.*
import kotlin.math.*
import org.json.JSONObject

object NativePlanRules {
  private fun jd(y: Int, m: Int, d: Int): Double =
    d + ceil(29.5 * (m - 1)) + (y - 1) * 354 + floor((3.0 + 11 * y) / 30) + 1948439.5 - 1

  fun hijri(date: LocalDate): Triple<Int, Int, Int> {
    val j = date.toEpochDay() + 2440587.5
    val year = floor((30 * (j - 1948439.5) + 10646) / 10631).toInt()
    val month = min(12, ceil((j - (29 + jd(year, 1, 1))) / 29.5).toInt() + 1)
    return Triple(year, month, (j - jd(year, month, 1) + 1).toInt())
  }

  fun due(r: JSONObject, date: LocalDate): Boolean {
    val start = LocalDate.parse(r.getString("startDate"))
    if (
      date < start ||
        (r.optString("endDate").isNotEmpty() && date > LocalDate.parse(r.getString("endDate")))
    )
      return false
    if (r.optString("frequency") == "unscheduled") return false
    if (r.optString("calendar") == "hijri") {
      val h = hijri(date.plusDays(r.optLong("hijriAdjustment", 0)))
      return h.second == r.optInt("hijriMonth") && h.third == r.optInt("hijriDay")
    }
    return when (r.optString("frequency")) {
      "once" -> date == start
      "weekdays" ->
        r.optJSONArray("weekdays")?.let { values ->
          (0 until values.length()).any { values.optInt(it) == date.dayOfWeek.value % 7 }
        } ?: false
      "weekly" -> date.dayOfWeek.value % 7 == r.optInt("weekday", 1)
      "monthly" -> date.dayOfMonth == min(r.optInt("monthday", 1), date.lengthOfMonth())
      "yearly" -> date.monthValue == start.monthValue && date.dayOfMonth == start.dayOfMonth
      "interval" ->
        java.time.temporal.ChronoUnit.DAYS.between(start, date) % max(1, r.optInt("interval", 1)) ==
          0L
      else -> true
    }
  }

  fun quiet(instant: Instant, s: JSONObject): Boolean {
    if (!s.optBoolean("quietEnabled")) return false
    val time = instant.atZone(ZoneId.of(s.getString("timezone"))).toLocalTime()
    val start = LocalTime.parse(s.optString("quietStart", "22:00"))
    val end = LocalTime.parse(s.optString("quietEnd", "07:00"))
    return if (start == end) true
    else if (start < end) time >= start && time < end else time >= start || time < end
  }
}
