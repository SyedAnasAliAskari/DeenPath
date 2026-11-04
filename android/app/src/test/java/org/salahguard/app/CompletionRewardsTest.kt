package org.salahguard.app
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
class CompletionRewardsTest {
 private fun economy(amount:Int)=JSONObject().put("claims",JSONObject().put("prayer:x",JSONObject().put("active",true).put("amount",amount)))
 @Test fun completionReceiptsUseOnlyActualGrant(){assertEquals(10,CompletionRewards.earned(null,economy(10),"prayer:x"));assertEquals(0,CompletionRewards.earned(economy(10),economy(10),"prayer:x"));assertEquals(2,CompletionRewards.earned(economy(8),economy(10),"prayer:x"));assertEquals(0,CompletionRewards.earned(economy(10),economy(8),"prayer:x"));assertEquals("Fajr Completed ✓ +10 Gems",CompletionRewards.receipt("Fajr",10));assertFalse(CompletionRewards.receipt("Fajr",0).contains("Gems"))}
}
