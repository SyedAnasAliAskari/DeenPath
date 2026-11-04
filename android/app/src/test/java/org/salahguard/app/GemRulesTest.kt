package org.salahguard.app
import org.json.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
class GemRulesTest {
 private val now=Instant.parse("2026-11-03T12:00:00Z")
 private fun root()=JSONObject().put("records",JSONArray().put(JSONObject().put("id","2026-11-03:Fajr").put("entity","prayer_records").put("data",JSONObject().put("day","2026-11-03").put("prayer","Fajr").put("windowStart","2026-11-03T00:00:00Z").put("windowEnd","2026-11-03T01:00:00Z").put("completedAt","2026-11-03T00:15:00Z"))))
 @Test fun retriesAndCorrectionsCannotFarm(){val r=root();GemRules.reconcile(r,now);assertEquals(10,r.getJSONObject("economy").getInt("balance"));GemRules.reconcile(r,now);assertEquals(1,r.getJSONObject("economy").getJSONObject("transactions").length());r.getJSONArray("records").getJSONObject(0).put("deleted",true);GemRules.reconcile(r,now);assertEquals(0,r.getJSONObject("economy").getInt("balance"));r.getJSONArray("records").getJSONObject(0).put("deleted",false);GemRules.reconcile(r,now,JSONObject(GemRules.defaults.toString()).put("prayer",100));assertEquals(10,r.getJSONObject("economy").getInt("balance"));assertEquals(3,r.getJSONObject("economy").getJSONObject("transactions").length())}
 @Test fun qazaReclassifiesOriginalClaim(){val r=root();GemRules.reconcile(r,now);val d=r.getJSONArray("records").getJSONObject(0).getJSONObject("data");d.remove("completedAt");d.put("qazaAt",now.toString());GemRules.reconcile(r,now);assertEquals(8,r.getJSONObject("economy").getInt("balance"))}
 @Test fun invalidFutureAndMissedHaveNoReward(){val r=root();val d=r.getJSONArray("records").getJSONObject(0).getJSONObject("data");d.put("completedAt","2027-01-01T00:00:00Z");GemRules.reconcile(r,now);assertEquals(0,r.getJSONObject("economy").getInt("balance"));d.remove("completedAt");GemRules.reconcile(r,now);assertEquals(0,r.getJSONObject("economy").getInt("balance"))}
}
