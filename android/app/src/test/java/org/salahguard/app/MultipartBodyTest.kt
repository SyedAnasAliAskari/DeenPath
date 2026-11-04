package org.salahguard.app

import org.junit.Assert.*
import org.junit.Test

class MultipartBodyTest {
  @Test
  fun usesRealCrLfAndSafeDispositionFields() {
    val p = MultipartBody.parts("uuid", "note\"\r\n.pdf", "application/pdf", true, "BOUNDARY")
    val text = String(p.prefix, Charsets.UTF_8)
    assertTrue(text.contains("\r\nContent-Disposition:"))
    assertTrue(text.contains("name=\"file\""))
    assertTrue(text.contains("filename=\"note___.pdf\""))
    assertFalse(text.contains("\\r\\n"))
    assertEquals("\r\n--BOUNDARY--\r\n", String(p.suffix, Charsets.UTF_8))
  }
}
