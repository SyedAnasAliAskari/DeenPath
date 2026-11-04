package org.salahguard.app
import org.json.*
import org.junit.Assert.*
import org.junit.Test
class SecretRulesTest {
 private val day="2026-10-30"
 private fun habit(kind:String="tasbih")=JSONObject().put("id","h").put("type","habit").put("name","Private habit").put("description","Private description").put("start","2026-10-28").put("recovery",JSONObject().put("kind",kind).put("title","Astaghfar").put("target",if(kind=="nafl")4 else 100))
 private fun plan(items:List<JSONObject>,records:List<JSONObject> = emptyList(),state:String="slipped")=SecretRules.plan(items,records,"h",day,state,day,"public-id","Asia/Karachi")
 @Test fun retriesDoNotDuplicatePenalty(){val h=habit();val p=plan(listOf(h));assertTrue(p.changed);assertEquals(1,p.publicRecords.size);assertFalse(p.publicRecords.toString().contains("Private"));assertFalse(plan(listOf(h)+p.privateItems,p.publicRecords).changed)}
 @Test fun avoidanceIsExactlyOneDailyCheckin(){val h=habit();val p=plan(listOf(h),state="avoided");assertEquals("h:$day",p.privateItems.single().getString("id"));assertTrue(p.publicRecords.isEmpty());assertFalse(plan(listOf(h)+p.privateItems,state="avoided").changed)}
 @Test fun naflUsesSeparateRoutine(){val p=plan(listOf(habit("nafl")));assertEquals("routines",p.publicRecords.single().getString("entity"));assertEquals(4,p.publicRecords.single().getJSONObject("data").getInt("target"))}
 @Test fun correctionsPreservePerformedWorship(){val h=habit();val p=plan(listOf(h));assertTrue(plan(listOf(h)+p.privateItems,p.publicRecords,"avoided").publicRecords.single().getBoolean("deleted"));for(entity in listOf("tasbih_progress","routine_completions")){val record=JSONObject().put("entity",entity).put("data",JSONObject().put("routineId","public-id").put("count",1));assertTrue(plan(listOf(h)+p.privateItems,p.publicRecords+record,"avoided").publicRecords.isEmpty())}}
 @Test fun legacyProjectionUsesOriginalPenalty(){val h=habit();val task=JSONObject().put("id","recovery:h:$day:0").put("type","recovery").put("kind","nafl").put("target",2).put("state","pending");val p=plan(listOf(h,task));assertEquals("nafl",p.publicRecords.single().getJSONObject("data").getString("kind"));assertEquals(2,p.publicRecords.single().getJSONObject("data").getInt("target"))}
 @Test fun invalidAndFutureAnswersFail(){for(date in listOf("2026-02-30","2026-11-01"))assertTrue(runCatching{SecretRules.plan(listOf(habit()),emptyList(),"h",date,"avoided",day,"id","Asia/Karachi")}.isFailure)}
}
