package org.salahguard.app

import com.batoulapps.adhan.*
import com.batoulapps.adhan.data.DateComponents
import java.time.Instant
import org.junit.Assert.assertTrue
import org.junit.Test

class PrayerParityTest {
  @Test
  fun karachiHanafiAgreesWithFrontendFixture() {
    val params = CalculationMethod.KARACHI.parameters
    params.madhab = Madhab.HANAFI
    val p = PrayerTimes(Coordinates(24.8607, 67.0011), DateComponents(2026, 10, 26), params)
    val actual = listOf(p.fajr, p.dhuhr, p.asr, p.maghrib, p.isha)
    val expected =
      listOf(
        "2026-10-26T00:19:00Z",
        "2026-10-26T07:17:00Z",
        "2026-10-26T11:19:00Z",
        "2026-10-26T12:56:00Z",
        "2026-10-26T14:13:00Z",
      )
    for (i in actual.indices) assertTrue(
      "Prayer $i differs from the frontend by more than one minute",
      kotlin.math.abs(actual[i].time - Instant.parse(expected[i]).toEpochMilli()) <= 60000,
    )
  }
}
