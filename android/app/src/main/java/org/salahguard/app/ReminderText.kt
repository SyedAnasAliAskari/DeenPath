package org.salahguard.app

import org.json.JSONObject

object ReminderText {
  fun title(r: JSONObject): String {
    val lang = r.optString("lang", "en")
    val route = r.optString("route")
    if(r.optBoolean("testSecrets"))return when(lang){"ur"->"راز کی یاد دہانی — جھلک";"ar"->"تذكير الأسرار — معاينة";else->"Secrets check-in — preview"}
    if (route.startsWith("prayer:")) {
      val parts = route.split(':')
      val name = parts.last()
      val friday = name == "Dhuhr" && r.optString("midday") != "Dhuhr" && runCatching {
        java.time.LocalDate.parse(parts[1]).dayOfWeek == java.time.DayOfWeek.FRIDAY
      }.getOrDefault(false)
      val names = when (lang) {
        "ur" -> mapOf("Fajr" to "فجر", "Dhuhr" to "ظہر", "Asr" to "عصر", "Maghrib" to "مغرب", "Isha" to "عشاء")
        "ar" -> mapOf("Fajr" to "الفجر", "Dhuhr" to "الظهر", "Asr" to "العصر", "Maghrib" to "المغرب", "Isha" to "العشاء")
        else -> emptyMap()
      }
      val label = if (friday) when(lang) { "ur" -> "جمعہ"; "ar" -> "الجمعة"; else -> "Jummah" } else names[name] ?: name
      return when(lang) { "ur" -> "$label کی یاد دہانی"; "ar" -> "تذكير صلاة $label"; else -> "$label prayer reminder" }
    }
    if (route == "test" && r.optString("testPrayer") in WidgetModel.selections.filter { it != "Overall" }) {
      val label=WidgetModel.label(r.getString("testPrayer"),lang)
      return when(lang) { "ur" -> "$label کی یاد دہانی — آزمائش"; "ar" -> "تذكير $label — تجربة"; else -> "$label prayer — test reminder" }
    }
    if (route == "test") return when(lang) {
      "ur" -> "فجر کی یاد دہانی — آزمائش"
      "ar" -> "تذكير الفجر — تجربة"
      else -> "Fajr prayer — test reminder"
    }
    return r.optString("title").ifBlank { "DeenPath" }
  }
}
