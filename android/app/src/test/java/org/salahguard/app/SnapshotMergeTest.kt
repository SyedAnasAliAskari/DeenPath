package org.salahguard.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class SnapshotMergeTest {
  @Test
  fun newEditSurvivesBackgroundAcknowledgment() {
    val base =
      JSONObject(
        """{"records":[{"entity":"tasbih_progress","id":"r","version":0,"data":{"count":1}}],"queue":[{"id":"a"}]}"""
      )
    val incoming =
      JSONObject(
        """{"records":[{"entity":"tasbih_progress","id":"r","version":0,"data":{"count":2}}],"queue":[{"id":"b"}]}"""
      )
    val remote =
      JSONObject(
        """{"records":[{"entity":"tasbih_progress","id":"r","version":1,"data":{"count":1}}],"queue":[],"lastSync":"confirmed"}"""
      )
    val result = SnapshotMerge.combine(base, incoming, remote)
    assertEquals(
      2,
      result.getJSONArray("records").getJSONObject(0).getJSONObject("data").getInt("count"),
    )
    assertEquals(1, result.getJSONArray("records").getJSONObject(0).getInt("version"))
    assertEquals("b", result.getJSONArray("queue").getJSONObject(0).getString("id"))
    assertEquals(1, result.getJSONArray("queue").length())
    assertEquals("confirmed", result.getString("lastSync"))
  }

  @Test
  fun tombstoneAndAvatarMetadataSurviveUnrelatedSettingsChange() {
    val base =
      JSONObject("""{"settings":{"appearance":"light"},"localFiles":[],"queue":[{"id":"a"}]}""")
    val incoming =
      JSONObject(base.toString()).put("settings", JSONObject().put("appearance", "dark"))
    val current =
      JSONObject(
        """{"settings":{"appearance":"light"},"localFiles":[{"id":"f","cloudId":"remote"}],"queue":[]}"""
      )
    val result = SnapshotMerge.combine(base, incoming, current)
    assertEquals(0, result.getJSONArray("queue").length())
    assertEquals("remote", result.getJSONArray("localFiles").getJSONObject(0).getString("cloudId"))
    assertEquals("dark", result.getJSONObject("settings").getString("appearance"))
  }
}
