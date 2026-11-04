package org.salahguard.app
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
class ReminderMaintenanceTest {
 private fun root()=JSONObject().put("owner",JSONObject.NULL).put("settings",JSONObject().put("enforcer",true)).put("records",JSONArray().put(JSONObject().put("entity","tasbih_progress").put("id","r:today").put("data",JSONObject().put("count",1))))
 @Test fun counterAndCollectionChangesDoNotRebuildThePrayerPlan(){val before=root();val after=JSONObject(before.toString());after.getJSONArray("records").getJSONObject(0).getJSONObject("data").put("count",2);after.put("collectibles",JSONObject().put("library",JSONObject()));assertEquals(ReminderMaintenance.planKey(before),ReminderMaintenance.planKey(after))}
 @Test fun completionSettingsAndOwnerChangesInvalidatePlanning(){val before=root();val after=JSONObject(before.toString());after.getJSONArray("records").put(JSONObject().put("entity","routine_completions").put("id","r:today").put("data",JSONObject().put("completedAt","2026-11-03T10:00:00Z")));assertNotEquals(ReminderMaintenance.planKey(before),ReminderMaintenance.planKey(after));val changed=root();changed.getJSONObject("settings").put("enforcer",false);assertNotEquals(ReminderMaintenance.planKey(before),ReminderMaintenance.planKey(changed));changed.put("owner","different-owner");assertNotEquals(ReminderMaintenance.planKey(before),ReminderMaintenance.planKey(changed))}
}
