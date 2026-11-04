package org.salahguard.app
import org.json.*
import org.junit.Assert.*
import org.junit.Test
class PurchaseRulesTest {
 @Test fun replayUsesOriginalQuoteAndIsIdempotent(){val root=JSONObject().put("economy",JSONObject().put("balance",100).put("claims",JSONObject()).put("transactions",JSONObject()).put("prices",JSONObject().put("colors",80)));val order=JSONObject().put("id","id").put("kind","colors").put("cost",50).put("payload",JSONObject().put("primary","#123456").put("secondary","#654321")).put("createdAt","2026-11-01T00:00:00Z").put("status","pending");PurchaseRules.replay(root,order);PurchaseRules.replay(root,order);assertEquals(50,root.getJSONObject("economy").getInt("balance"));assertEquals(1,root.getJSONObject("economy").getJSONObject("transactions").length())}
 @Test fun offlineConflictCannotCreateDebt(){val root=JSONObject().put("economy",JSONObject().put("balance",0).put("transactions",JSONObject()));val order=JSONObject().put("id","id").put("kind","unlock").put("cost",1000);assertTrue(runCatching{PurchaseRules.replay(root,order)}.isFailure);assertEquals(0,root.getJSONObject("economy").getInt("balance"))}
}
