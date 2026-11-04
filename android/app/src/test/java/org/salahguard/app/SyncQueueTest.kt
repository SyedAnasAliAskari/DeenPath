package org.salahguard.app
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
class SyncQueueTest {
 @Test fun removedForegroundOperationsAreNotSentFromAStaleBatch(){val current=JSONObject().put("queue",JSONArray().put(JSONObject().put("id","latest").put("record",JSONObject().put("version",0))));assertNull(SyncQueue.candidate(current,"superseded"));assertNotNull(SyncQueue.candidate(current,"latest"))}
 @Test fun laterRequestsUseTheVersionRebasedByTheEarlierAcknowledgment(){val current=JSONObject().put("queue",JSONArray().put(JSONObject().put("id","pending").put("record",JSONObject().put("version",0).put("data",JSONObject().put("count",20)))));current.getJSONArray("queue").getJSONObject(0).getJSONObject("record").put("version",4);assertEquals(4,SyncQueue.candidate(current,"pending")!!.getJSONObject("record").getInt("version"));assertEquals(20,SyncQueue.candidate(current,"pending")!!.getJSONObject("record").getJSONObject("data").getInt("count"))}
}
