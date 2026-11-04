package org.salahguard.app
import org.json.*
import org.junit.Assert.*
import org.junit.Test
class ThemeRulesTest {
 private val id="12345678-1234-1234-1234-123456789abc"
 private fun root(balance:Int)=JSONObject().put("records",JSONArray()).put("economy",JSONObject().put("version",1).put("balance",balance).put("claims",JSONObject()).put("transactions",JSONObject()))
 @Test fun unlockRetryIsAtomic(){val r=root(1200);ThemeRules.purchase(r,id,"unlock",JSONObject());assertEquals(200,r.getJSONObject("economy").getInt("balance"));ThemeRules.purchase(r,id,"unlock",JSONObject());assertEquals(200,r.getJSONObject("economy").getInt("balance"));assertEquals(1,r.getJSONObject("economy").getJSONObject("orders").length())}
 @Test fun freeDefaultsSurviveNegativeCorrection(){val r=root(-100);ThemeRules.purchase(r,id,"default",JSONObject());assertEquals(-100,r.getJSONObject("economy").getInt("balance"));assertEquals(0,r.getJSONObject("economy").getJSONObject("theme").length())}
 @Test fun invalidAndInsufficientPurchasesFail(){val r=root(0);assertTrue(runCatching{ThemeRules.purchase(r,id,"unlock",JSONObject())}.isFailure);assertFalse(r.getJSONObject("economy").has("orders"));assertTrue(runCatching{ThemeRules.clean("wallpaper",JSONObject().put("fileId","../../bad"))}.isFailure)}
}
