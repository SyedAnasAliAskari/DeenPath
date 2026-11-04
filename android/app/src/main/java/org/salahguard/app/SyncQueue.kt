package org.salahguard.app
import org.json.JSONObject
object SyncQueue {
 fun candidate(root:JSONObject,id:String):JSONObject? {
  val queue=root.optJSONArray("queue")?:return null
  return (0 until queue.length()).map{queue.getJSONObject(it)}.firstOrNull{it.optString("id")==id}
 }
}
