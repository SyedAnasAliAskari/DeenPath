package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
class PrayerCadenceTest {
 private val m=60000L
 @Test fun hourWindowMatchesRequestedExampleAndNeverSchedulesQaza(){
  val t=PrayerCadence.ticks(0,60*m,JSONObject())
  assertEquals(listOf(0L,15L),t.filter{it.stage==0}.map{it.at/m})
  assertEquals(listOf(25L,35L),t.filter{it.stage==1}.map{it.at/m})
  assertEquals((45L..59L).toList(),t.filter{it.stage==2}.map{it.at/m})
  assertTrue(t.none{it.at>=60*m||it.stage==3});assertEquals(t.size,t.map{it.at}.distinct().size)
 }
 @Test fun userIntervalsAndBoundariesAreApplied(){val s=JSONObject().put("reminderMiddlePercent",50).put("reminderFinalPercent",80).put("reminderRepeat",JSONObject().put("gentle",5).put("warning",2).put("strict",1));val t=PrayerCadence.ticks(0,100*m,s);assertEquals((0L..45L step 5).toList(),t.filter{it.stage==0}.map{it.at/m});assertEquals((50L..78L step 2).toList(),t.filter{it.stage==1}.map{it.at/m});assertEquals((80L..99L).toList(),t.filter{it.stage==2}.map{it.at/m})}
 @Test fun onceIsRespectedAndVeryShortWindowsDoNotOverflow(){val s=JSONObject().put("reminderRepeat",JSONObject().put("gentle",0).put("warning",0).put("strict",0));assertEquals(3,PrayerCadence.ticks(0,60*m,s).size);val t=PrayerCadence.ticks(1000,2000,JSONObject());assertTrue(t.all{it.at>=1000&&it.at<2000})}
 @Test fun serviceAndAlarmOptOutStayIndependent(){assertTrue(EnforcerServiceRules.enabled(JSONObject().put("enforcer",true)));assertFalse(EnforcerServiceRules.enabled(JSONObject().put("enforcer",false)));assertFalse(EnforcerServiceRules.enabled(JSONObject().put("enforcer",true).put("reliablePrayerAlarms",false)))}
}
