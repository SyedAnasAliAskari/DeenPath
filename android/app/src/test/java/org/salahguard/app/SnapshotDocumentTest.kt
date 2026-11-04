package org.salahguard.app

import org.junit.Assert.*
import org.junit.Test

class SnapshotDocumentTest {
  @Test
  fun freshInstallHasLocalScopeBeforeFirstSave() {
    assertEquals("local", SnapshotDocument.owner(""))
    assertEquals("local", SnapshotDocument.owner("  \n"))
    assertEquals(0, SnapshotDocument.parse("").length())
  }

  @Test
  fun existingScopeIsPreserved() {
    assertEquals("account-123", SnapshotDocument.owner("""{"owner":"account-123"}"""))
    assertEquals("local", SnapshotDocument.owner("""{"owner":null}"""))
  }

  @Test
  fun corruptNonemptyDataIsNotSilentlyReplaced() {
    assertThrows(org.json.JSONException::class.java) { SnapshotDocument.parse("broken snapshot") }
  }
}
