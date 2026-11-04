package org.salahguard.app

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RoutinePeriodsTest {
  @Test
  fun deadlineAndWeeklyKeysMatchFrontend() {
    val r =
      JSONObject()
        .put("timezone", "Asia/Karachi")
        .put("frequency", "daily")
        .put("deadline", "04:00")
    assertEquals("2026-10-26", RoutinePeriods.key(r, Instant.parse("2026-10-26T22:00:00Z")))
    r.put("frequency", "weekly")
    assertEquals("2026-10-26", RoutinePeriods.key(r, Instant.parse("2026-10-29T12:00:00Z")))
  }
  @org.junit.Test fun selectedPrayerStartResetsWithoutCompletion() {
    val routine=org.json.JSONObject("""{"frequency":"after_prayer","resetPrayers":["Fajr","Isha"],"startDate":"2026-10-29","timezone":"Asia/Karachi","resetSettings":{"lat":24.8607,"lng":67.0011,"method":"Karachi","hanafi":true,"timezone":"Asia/Karachi","adjustments":[0,0,0,0,0]}}""")
    org.junit.Assert.assertEquals("2026-10-29:start",RoutinePeriods.key(routine,java.time.Instant.parse("2026-10-29T00:10:00Z")))
    org.junit.Assert.assertEquals("2026-10-29:Fajr",RoutinePeriods.key(routine,java.time.Instant.parse("2026-10-29T02:00:00Z")))
    org.junit.Assert.assertEquals("2026-10-29:Isha",RoutinePeriods.key(routine,java.time.Instant.parse("2026-10-29T20:00:00Z")))
  }
}
