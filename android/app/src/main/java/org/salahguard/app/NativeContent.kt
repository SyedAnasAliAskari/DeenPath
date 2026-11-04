package org.salahguard.app

import android.content.Context
import org.json.JSONObject

object NativeContent {
  @Volatile private var data: JSONObject? = null

  private fun collection(c: Context): JSONObject? =
    data
      ?: runCatching {
        JSONObject(c.assets.open("islamic-reminders.json").bufferedReader().use { it.readText() })
      }
        .getOrNull()
        ?.also { data = it }

  fun language(settings: JSONObject): String =
    settings.optString("reminderLanguage").takeIf { it in listOf("en", "ur", "both", "none") }
      ?: "both"

  fun format(collection: JSONObject, ref: String, language: String): String {
    if (language == "both") {
      val en = collection.optJSONObject("translations")?.optJSONObject("en")
      val ur = collection.optJSONObject("translations")?.optJSONObject("ur")
      return listOf(format(collection, ref, "none"), "English · " + en?.optString("translator").orEmpty() + "\n" + en?.optJSONObject("verses")?.optString(ref).orEmpty(), "اردو · " + ur?.optString("translator").orEmpty() + "\n" + ur?.optJSONObject("verses")?.optString(ref).orEmpty()).joinToString("\n\n")
    }
    val rows = collection.optJSONArray("verses")
    var arabic = ""
    if (rows != null)
      for (i in 0 until rows.length()) {
        val row = rows.getJSONObject(i)
        if (row.optString("ref") == ref) {
          arabic = row.getString("text")
          break
        }
      }
    val translation =
      if (language == "none") ""
      else
        collection
          .optJSONObject("translations")
          ?.optJSONObject(language)
          ?.optJSONObject("verses")
          ?.optString(ref)
          .orEmpty()
    return listOf(
        translation,
        arabic,
        (if (language == "en") "Quran " else "القرآن ") + ref + " · Tanzil" +
          (if (language == "none") "" else " · " + collection.optJSONObject("translations")?.optJSONObject(language)?.optString("translator").orEmpty()),
      )
      .filter { it.isNotBlank() }
      .joinToString("\n\n")
  }

  fun reminder(c: Context, ref: String, language: String): String =
    collection(c)?.let { format(it, ref, language) } ?: "Quran $ref"

  fun verse(c: Context, ref: String): String = reminder(c, ref, "none")
}
