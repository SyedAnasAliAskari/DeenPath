package org.salahguard.app
import org.json.JSONObject

data class PrayerReminderTick(val at:Long,val stage:Int)
object PrayerCadence {
 fun ticks(start:Long,end:Long,s:JSONObject):List<PrayerReminderTick>{
  require(end>start)
  val duration=end-start
  val middle=s.optDouble("reminderMiddlePercent",42.0).coerceIn(1.0,98.0)
  val final=s.optDouble("reminderFinalPercent",75.0).coerceIn(middle+1.0,99.0)
  fun boundary(percent:Double):Long {
    val offset=if(duration>=60000) kotlin.math.round(duration*percent/100/60000).toLong()*60000 else (duration*percent/100).toLong()
    return (start+offset).coerceIn(start,end)
  }
  val boundaries=listOf(start,boundary(middle),boundary(final),end)
  val result=mutableListOf<PrayerReminderTick>()
  for(stage in 0..2){
   var at=boundaries[stage]
   val minutes=s.optJSONObject("reminderRepeat")?.optInt(listOf("gentle","warning","strict")[stage],listOf(15,10,1)[stage])?:listOf(15,10,1)[stage]
   while(at<boundaries[stage+1]){
    result.add(PrayerReminderTick(at,stage));if(minutes<=0)break
    at+=minutes.coerceIn(1,60)*60000L
   }
  }
  return result.distinctBy{it.at}.sortedBy{it.at}
 }
}
object EnforcerServiceRules {
 fun enabled(s:JSONObject)=s.optBoolean("enforcer")&&s.optBoolean("reliablePrayerAlarms",true)
}
