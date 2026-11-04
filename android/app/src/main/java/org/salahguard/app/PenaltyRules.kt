package org.salahguard.app
import org.json.*
import java.time.Instant
/** Public schedule metadata deliberately excludes the secret, amount and currency. */
object PenaltyRules {
 fun times(createdAt:String,dueAt:String):List<Long> = runCatching {
  val start=Instant.parse(createdAt).toEpochMilli(); val end=minOf(Instant.parse(dueAt).toEpochMilli(),start+86400000)
  (1..5).map{start+it*14400000L}.filter{it<end}
 }.getOrDefault(emptyList())
 fun pending(item:JSONObject,records:List<JSONObject>,now:Long):Boolean {
  if(item.optString("kind")=="charity"&&item.optString("completedAt").isNotEmpty())return false
  if(runCatching{Instant.parse(item.getString("dueAt")).toEpochMilli()}.getOrDefault(0)<=now)return false
  val id=item.optString("routineId");if(id.isEmpty())return true
  return records.any{it.optString("entity")=="routines"&&it.optString("id")==id&&!it.optBoolean("deleted")} && !records.any{it.optString("entity")=="routine_completions"&&!it.optBoolean("deleted")&&it.optJSONObject("data")?.optString("routineId")==id}
 }
 fun schedules(items:List<JSONObject>,records:List<JSONObject>):JSONArray {
  val out=JSONArray()
  for(t in items)if(t.optString("type")=="recovery"&&t.optString("state")=="pending"&&t.has("createdAt")&&t.has("dueAt")&&pending(t,records,0)){
   val item=JSONObject().put("id",t.getString("id")).put("createdAt",t.getString("createdAt")).put("dueAt",t.getString("dueAt"))
   if(t.optString("routineId").isNotEmpty())item.put("routineId",t.getString("routineId"));out.put(item)
  };return out
 }
}
