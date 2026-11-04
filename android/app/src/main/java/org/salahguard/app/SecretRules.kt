package org.salahguard.app
import org.json.*
import java.time.LocalDate

data class SecretPlan(val changed:Boolean,val privateItems:List<JSONObject>,val publicRecords:List<JSONObject>)
object SecretRules {
 fun plan(items:List<JSONObject>,records:List<JSONObject>,habitId:String,day:String,state:String,today:String,newRoutineId:String,timezone:String,now:String=java.time.Instant.now().toString()):SecretPlan {
  require(state in listOf("avoided","slipped"));LocalDate.parse(day)
  val h=items.firstOrNull{it.optString("type")=="habit"&&it.optString("id")==habitId} ?: error("Secret not found")
  require(!h.optBoolean("archived")&&day>=h.getString("start")&&day<=today){"Invalid Secrets check-in"}
  val id="$habitId:$day";val prior=items.firstOrNull{it.optString("type")=="checkin"&&it.optString("id")==id}
  val taskId="recovery:$habitId:$day:0";val task=items.firstOrNull{it.optString("id")==taskId}
  if(prior?.optString("state")==state&&(state=="avoided"||!task?.optString("routineId").isNullOrEmpty()||task?.optString("kind")=="charity"||task?.optString("state")=="done"))return SecretPlan(false,emptyList(),emptyList())
  val check=JSONObject(prior?.toString()?:"{}").put("id",id).put("type","checkin").put("habitId",habitId).put("day",day).put("state",state).put("count",if(state=="slipped")1 else 0).put("note",prior?.optString("note")?:"")
  val privateItems=mutableListOf(check);val publicRecords=mutableListOf<JSONObject>();val spec=task?:h.optJSONObject("recovery")
  if(state=="slipped"&&spec!=null){
   val routineId=task?.optString("routineId")?.takeIf{it.isNotEmpty()}?:newRoutineId;val kind=spec.optString("kind").takeIf{it in listOf("nafl","charity")}?:"tasbih";val target=maxOf(1,spec.optInt("target",1))
   if(kind=="charity")require(spec.opt("amountMinor") is Number && (spec.opt("amountMinor") as Number).toDouble()==spec.optLong("amountMinor").toDouble() && spec.optLong("amountMinor") in 1..99999999999L && Regex("[A-Z]{3}").matches(spec.optString("currency"))){"Invalid charity amount or currency"}
   val createdAt=task?.optString("createdAt")?.takeIf{it.isNotEmpty()}?:now
   val dueAt=task?.optString("dueAt")?.takeIf{it.isNotEmpty()}?:java.time.Instant.parse(createdAt).plusSeconds(86400).toString()
   val recovery=JSONObject(task?.toString()?:"{}").put("id",taskId).put("type","recovery").put("habitId",habitId).put("day",day).put("kind",kind).put("title",spec.optString("title")).put("target",target).put("count",task?.optInt("count")?:0).put("state",if(task?.optString("state")=="done"||kind=="charity"&&!task?.optString("completedAt").isNullOrEmpty())"done" else "pending").put("routineId",routineId).put("source","secret-checkin").put("createdAt",createdAt).put("dueAt",dueAt)
   if(task!=null&&!task.has("createdAt")){recovery.remove("createdAt");recovery.remove("dueAt")}
   if(kind=="charity"){recovery.remove("routineId");recovery.put("amountMinor",spec.getLong("amountMinor")).put("currency",spec.getString("currency"))}
   privateItems.add(recovery)
   val existing=records.firstOrNull{it.optString("entity")=="routines"&&it.optString("id")==routineId}
   if(kind!="charity"&&task?.optString("state")!="done"&&(existing==null||existing.optBoolean("deleted")))publicRecords.add(JSONObject().put("id",routineId).put("entity","routines").put("deleted",false).put("data",JSONObject().put("title",if(kind=="nafl")"Nafl penalty" else "Tasbih penalty").put("kind",kind).put("target",target).put("dhikr",if(kind=="tasbih")spec.optString("title").ifBlank{"أَسْتَغْفِرُ اللَّهَ"} else "").put("frequency","unscheduled").put("timezone",timezone).put("startDate",day).put("time","00:00").put("generated",true).put("secretPenalty",true)))
  }else if(state=="avoided"&&task!=null){
   privateItems.add(JSONObject(task.toString()).put("state","dismissed"));val routineId=task.optString("routineId");val routine=records.firstOrNull{it.optString("entity")=="routines"&&it.optString("id")==routineId&&!it.optBoolean("deleted")}
   val performed=records.any{val d=it.optJSONObject("data")?:JSONObject();!it.optBoolean("deleted")&&d.optString("routineId")==routineId&&(it.optString("entity")=="routine_completions"||it.optString("entity")=="tasbih_progress"&&d.optInt("count")>0)}
   if(routine!=null&&!performed)publicRecords.add(JSONObject(routine.toString()).put("deleted",true))
  }
  return SecretPlan(true,privateItems,publicRecords)
 }
}
