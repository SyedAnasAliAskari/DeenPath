package org.salahguard.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ReminderTextTest {
  @Test fun titleNamesThePrayerEvenWhenOldPayloadHasGenericTitle() {
    val r = JSONObject().put("title", "Reminder").put("route", "prayer:2026-10-01:Asr")
    assertEquals("Asr prayer reminder", ReminderText.title(r))
    r.put("route", "prayer:2026-10-02:Dhuhr")
    assertEquals("Jummah prayer reminder", ReminderText.title(r))
    r.put("midday", "Dhuhr")
    assertEquals("Dhuhr prayer reminder", ReminderText.title(r))
    r.remove("midday")
    r.put("lang", "ur")
    assertTrue(ReminderText.title(r).contains("جمعہ"))
  }
  @Test fun routineKeepsItsNameAndTestIsClearlyLabelled() {
    assertEquals("Evening Dua", ReminderText.title(JSONObject().put("route", "routine:abc").put("title", "Evening Dua")))
    assertTrue(ReminderText.title(JSONObject().put("route", "test")).contains("Fajr"))
    assertTrue(ReminderText.title(JSONObject().put("route", "test")).contains("test"))
  }
  @org.junit.Test fun testPreviewNamesTheCalculatedPrayer() {
    org.junit.Assert.assertEquals("Dhuhr prayer — test reminder",ReminderText.title(org.json.JSONObject().put("route","test").put("testPrayer","Dhuhr").put("lang","en")))
    org.junit.Assert.assertEquals("Jummah prayer — test reminder",ReminderText.title(org.json.JSONObject().put("route","test").put("testPrayer","Jummah").put("lang","en")))
  }

}
