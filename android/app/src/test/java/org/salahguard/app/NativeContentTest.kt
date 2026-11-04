package org.salahguard.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeContentTest {
  private fun source() =
    JSONObject(
      javaClass.classLoader!!.getResourceAsStream("quran.json")!!.bufferedReader().use {
        it.readText()
      }
    )

  @Test
  fun englishAndUrduMeaningsAreIncludedInNotificationBody() {
    val q = source()
    for (lang in listOf("en", "ur")) {
      val message = NativeContent.format(q, "20:14", lang)
      val expected =
        q.getJSONObject("translations")
          .getJSONObject(lang)
          .getJSONObject("verses")
          .getString("20:14")
      assertTrue(message.startsWith(expected))
      assertTrue(message.contains("20:14"))
      assertTrue(message.contains("Tanzil"))
      assertTrue(message.split("\n\n").size >= 3)
    }
  }

  @Test
  fun bothTranslationsHaveMeaningAndCredits() {
    val q = source(); val message = NativeContent.format(q, "20:14", "both")
    for (lang in listOf("en", "ur")) {
      val t = q.getJSONObject("translations").getJSONObject(lang)
      assertTrue(message.contains(t.getJSONObject("verses").getString("20:14")))
      assertTrue(message.contains(t.getString("translator")))
    }
  }
  @Test
  fun arabicOnlyIsAnExplicitChoice() {
    val text = NativeContent.format(source(), "20:14", "none")
    assertFalse(text.contains("Verily"))
    assertEquals("both", NativeContent.language(JSONObject().put("lang", "ur")))
    assertEquals("both", NativeContent.language(JSONObject().put("lang", "en")))
  }
}
