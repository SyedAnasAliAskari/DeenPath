package org.salahguard.app

import java.time.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DeenRulesTest {
  @Test
  fun weekdayAndEndDate() {
    val r =
      JSONObject(
        """{"frequency":"weekdays","weekdays":[1],"startDate":"2026-10-01","endDate":"2026-10-10"}"""
      )
    assertTrue(NativePlanRules.due(r, LocalDate.parse("2026-10-05")))
    assertFalse(NativePlanRules.due(r, LocalDate.parse("2026-10-12")))
  }

  @Test
  fun civilHijriParity() {
    assertEquals(Triple(1447, 9, 2), NativePlanRules.hijri(LocalDate.parse("2026-02-19")))
  }

  @Test
  fun quietAcrossMidnight() {
    val s =
      JSONObject(
        """{"quietEnabled":true,"timezone":"UTC","quietStart":"22:00","quietEnd":"07:00"}"""
      )
    assertTrue(NativePlanRules.quiet(Instant.parse("2026-10-01T23:00:00Z"), s))
    assertFalse(NativePlanRules.quiet(Instant.parse("2026-10-01T12:00:00Z"), s))
  }

  @Test
  fun encryptionRoundTripUsesUniqueIvs() {
    val key = ByteArray(32) { it.toByte() }
    val a = PrivateCrypto.seal(key, "private reflection")
    val b = PrivateCrypto.seal(key, "private reflection")
    assertNotEquals(a, b)
    assertEquals("private reflection", PrivateCrypto.open(key, a))
    assertFalse(a.contains("reflection"))
  }

  @Test
  fun wrongKeyCannotDecrypt() {
    val a = PrivateCrypto.seal(ByteArray(32) { 1 }, "private")
    assertThrows(Exception::class.java) { PrivateCrypto.open(ByteArray(32) { 2 }, a) }
  }

  @Test
  fun ciphertextTamperingIsRejected() {
    val key = ByteArray(32) { 1 }
    val raw = java.util.Base64.getDecoder().decode(PrivateCrypto.seal(key, "private"))
    raw[raw.lastIndex] = (raw.last().toInt() xor 1).toByte()
    assertThrows(Exception::class.java) {
      PrivateCrypto.open(key, java.util.Base64.getEncoder().encodeToString(raw))
    }
  }
}
