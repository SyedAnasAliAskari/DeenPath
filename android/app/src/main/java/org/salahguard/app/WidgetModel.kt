package org.salahguard.app

import java.time.*
import java.time.format.DateTimeFormatter
import org.json.JSONArray
import org.json.JSONObject

/** Saved public worship projections. Private records, account details and keys are never read. */
object WidgetModel {
  val selections = listOf("Overall", "Fajr", "Dhuhr", "Jummah", "Asr", "Maghrib", "Isha")
  private val prayerNames = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
  fun rows(root: JSONObject, entity: String): List<JSONObject> {
    val all = root.optJSONArray("records") ?: return emptyList()
    return (0 until all.length()).map { all.getJSONObject(it) }
      .filter { it.optString("entity") == entity && !it.optBoolean("deleted") }
  }
  private fun translated(lang: String, en: String, ur: String, ar: String) = when (lang) {
    "ur" -> ur; "ar" -> ar; else -> en
  }
  fun label(name: String, lang: String) = when (name) {
    "Overall" -> translated(lang, "Overall prayer", "مجموعی نماز", "الصلوات الإجمالية")
    "Fajr" -> translated(lang, "Fajr", "فجر", "الفجر")
    "Dhuhr" -> translated(lang, "Dhuhr", "ظہر", "الظهر")
    "Jummah" -> translated(lang, "Jummah", "جمعہ", "الجمعة")
    "Asr" -> translated(lang, "Asr", "عصر", "العصر")
    "Maghrib" -> translated(lang, "Maghrib", "مغرب", "المغرب")
    else -> translated(lang, "Isha", "عشاء", "العشاء")
  }
  fun onTime(data: JSONObject): Boolean = runCatching {
    val at = Instant.parse(data.getString("completedAt"))
    at >= Instant.parse(data.getString("windowStart")) && at < Instant.parse(data.getString("windowEnd"))
  }.getOrDefault(false)

  fun projection(root: JSONObject, kind: String, selection: String = "Overall", now: Instant = Instant.now()): JSONObject {
    require(selection in selections)
    val s = root.optJSONObject("settings") ?: return JSONObject().put("title", "Open DeenPath").put("body", "Set up your prayer location")
    val lang = s.optString("lang", "en")
    fun tr(en: String, ur: String, ar: String) = translated(lang, en, ur, ar)
    val routines = rows(root, "routines")
    val completions = rows(root, "routine_completions")
    // Garden data remains available when prayer location/calculation settings need attention.
    if(kind in listOf("garden","collection","gems")){
      val collection=root.optJSONObject("collectibles")?:JSONObject();val library=collection.optJSONObject("library")?:JSONObject();val copies=collection.optJSONObject("copies")?:JSONObject()
      val visible=copies.keys().asSequence().map{copies.getJSONObject(it)}.filter{!it.optBoolean("hidden")&&library.optJSONObject(it.optString("cardId"))?.optString("status") in listOf("published","flagged")}.toList();val unique=visible.map{it.optString("cardId")}.distinct().size
      if(kind!="gems")return JSONObject().put("title",tr("My Collection","میرا مجموعہ","مجموعتي")).put("body","${visible.size} "+tr("cards saved","کارڈ محفوظ","بطاقات محفوظة")).put("detail","$unique "+tr("unique stories · Open your shelf","منفرد کہانیاں · اپنا مجموعہ کھولیں","قصص فريدة · افتح مجموعتك")).put("done",unique).put("total",maxOf(1,visible.size))
      val economy=root.optJSONObject("economy")?:GemRules.reconcile(JSONObject(root.toString())).optJSONObject("economy")?:JSONObject();val balance=economy.optLong("balance");val cost=economy.optJSONObject("prices")?.optInt("pack",500)?:500
      return JSONObject().put("title","$balance "+tr("Gems","جواہرات","جواهر")).put("amount",balance).put("body",if(balance>=cost)tr("A new pack is ready","نیا پیک کھول سکتے ہیں","حزمة جديدة جاهزة")else tr("Keep taking small steps","چھوٹے قدم جاری رکھیں","واصل خطواتك الصغيرة")).put("detail",tr("App engagement points · Open Gems","ایپ کے جواہرات · بیلنس کھولیں","نقاط تفاعل التطبيق · افتح الجواهر")).put("done",balance.coerceIn(0,cost.toLong())).put("total",cost)
    }
    val zone = ZoneId.of(s.optString("timezone", "Asia/Karachi"))
    val day = now.atZone(zone).toLocalDate()
    val records = rows(root, "prayer_records").associate { it.getString("id") to it.getJSONObject("data") }
    val calculations = mutableMapOf<LocalDate, List<NativePrayerWindow>>()
    fun windows(date: LocalDate) = calculations.getOrPut(date) { PrayerWindows.calculate(date, s).map { PrayerWindows.recorded(it, records[it.id]) } }
    fun status(date: LocalDate, name: String): String {
      val data = records["$date:$name"]
      if (data?.optString("status") == "na") return "na"
      if (data != null && !data.isNull("qazaAt") && data.optString("qazaAt").isNotEmpty()) return "qaza"
      if (data != null && !data.isNull("completedAt") && data.optString("completedAt").isNotEmpty()) {
        val valid = runCatching {
          val fallback by lazy { windows(date).first { it.name == name } }
          val start = data.optString("windowStart").takeIf { it.isNotEmpty() }?.let(Instant::parse) ?: Instant.ofEpochMilli(fallback.start)
          val end = data.optString("windowEnd").takeIf { it.isNotEmpty() }?.let(Instant::parse) ?: Instant.ofEpochMilli(fallback.end)
          val at = Instant.parse(data.getString("completedAt"))
          at >= start && at < end
        }.getOrDefault(false)
        return if (valid) "ontime" else "missed"
      }
      if (data?.optString("status") == "missed") return "missed"
      if (date < day.minusDays(1)) return "unknown"
      if (date > day) return "notDue"
      val fallback by lazy { windows(date).first { it.name == name } }
      val start = data?.optString("windowStart")?.takeIf { it.isNotEmpty() }?.let(Instant::parse) ?: Instant.ofEpochMilli(fallback.start)
      val end = data?.optString("windowEnd")?.takeIf { it.isNotEmpty() }?.let(Instant::parse) ?: Instant.ofEpochMilli(fallback.end)
      return if (now < start) "notDue" else if (now < end) "open" else "unknown"
    }
    val statuses = prayerNames.map { status(day, it) }
    val total = statuses.count { it != "na" }
    val done = statuses.count { it == "ontime" || it == "qaza" }
    val due = routines.filter { val data = it.getJSONObject("data"); NativePlanRules.due(data, now.atZone(ZoneId.of(data.getString("timezone"))).toLocalDate()) }
    val completionIds = completions.map { it.getString("id") }.toSet()
    val routinesDone = due.count { it.getString("id") + ":" + RoutinePeriods.key(it.getJSONObject("data"), now, root.optJSONArray("records") ?: JSONArray()) in completionIds }
    val out = JSONObject().put("done", done).put("total", total).put("routineDone", routinesDone).put("routineTotal", due.size)
    if (kind == "daily") {
      val reset=due.filter {it.getJSONObject("data").optString("frequency")=="after_prayer"}.mapNotNull {runCatching {RoutinePeriods.next(it.getJSONObject("data"),now)}.getOrNull()}.minOrNull()
      if(reset!=null)out.put("target",reset)
      return out.put("title", tr("Today’s progress", "آج کی پیش رفت", "تقدم اليوم"))
        .put("body", tr("Prayers", "نمازیں", "الصلوات") + " $done / $total\n" + tr("Routines", "معمولات", "الأوراد") + " $routinesDone / ${due.size}")
        .put("detail", tr("A little effort, every day", "ہر روز تھوڑی سی کوشش", "جهد قليل كل يوم"))
    }
    if (kind == "prayer") {
      val all = (windows(day.minusDays(1)) + windows(day) + windows(day.plusDays(1))).sortedBy { it.start }
      val active = all.firstOrNull { now.toEpochMilli() >= it.start && now.toEpochMilli() < it.end }
      val next = all.firstOrNull { it.start > now.toEpochMilli() }
      val w = active ?: next ?: return out.put("title", "Prayer times unavailable").put("body", "Open Prayer")
      val display = if (w.name == "Dhuhr" && w.day.dayOfWeek == DayOfWeek.FRIDAY && records[w.id]?.optString("midday") != "Dhuhr") "Jummah" else w.name
      val format = DateTimeFormatter.ofPattern("h:mm a", java.util.Locale.forLanguageTag(lang)).withZone(zone)
      return out.put("title", label(display, lang))
        .put("body", if (active != null) tr("Ends ", "اختتام ", "ينتهي ") + format.format(Instant.ofEpochMilli(w.end)) else tr("Next prayer · ", "اگلی نماز · ", "الصلاة التالية · ") + format.format(Instant.ofEpochMilli(w.start)))
        .put("target", if (active != null) w.end else w.start)
        .put("detail", "$done / $total " + tr("prayers recorded", "نمازیں درج", "صلوات مسجلة"))
    }
    // Exactly the same skip/break semantics as prayerReport in the app.
    val earliest = records.keys.mapNotNull { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }.minOrNull() ?: day
    var date = runCatching { LocalDate.parse(s.optString("trackingStart")) }.getOrDefault(earliest)
    var current = 0
    var best = 0
    while (date <= day) {
      val friday = date.dayOfWeek == DayOfWeek.FRIDAY
      val midday = if (friday && records["$date:Dhuhr"]?.optString("midday") != "Dhuhr") "Jummah" else "Dhuhr"
      val names = when (selection) {
        "Overall" -> prayerNames
        "Dhuhr", "Jummah" -> if (selection == midday) listOf("Dhuhr") else emptyList()
        else -> listOf(selection)
      }
      val eligible = names.map { status(date, it) }.filter { it != "na" }
      val failed = eligible.any { it == "missed" || it == "unknown" || it == "qaza" }
      if (failed) current = 0
      else if (eligible.isNotEmpty() && eligible.none { it == "notDue" || it == "open" }) {
        current++
        best = maxOf(best, current)
      }
      date = date.plusDays(1)
    }
    return out.put("title", label(selection, lang) + " · " + tr("streak", "تسلسل", "تتابع"))
      .put("body", "$current " + tr("days", "دن", "أيام"))
      .put("detail", tr("Best", "بہترین", "الأفضل") + " · $best " + tr("days", "دن", "أيام"))
      .put("current", current).put("best", best).put("done", current).put("total", maxOf(7, best))
  }
}
