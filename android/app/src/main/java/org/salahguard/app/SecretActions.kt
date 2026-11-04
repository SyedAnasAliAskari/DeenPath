package org.salahguard.app
import android.content.Context
import org.json.*
import java.time.*
import java.util.UUID
object SecretActions {
 fun items(c:Context,root:JSONObject):List<JSONObject> {
  require(DeenPrivacy.status(c).getBoolean("unlocked")){"Unlock Secrets first"}
  val rows=root.optJSONArray("records")?:JSONArray()
  return (0 until rows.length()).map{rows.getJSONObject(it)}.filter{it.optString("entity")=="private_records"&&!it.optBoolean("deleted")}.map{JSONObject(DeenPrivacy.open(c,it.getJSONObject("data").getString("sealed"))).put("id",it.getString("id"))}
 }
 fun answer(c:Context,owner:String,habitId:String,day:String,state:String,event:JSONObject?=null):Boolean {
  if(event!=null)require(PrayerActions.active(c,event)){"This check-in reminder has expired"}
  var changed=false
  LocalDatabase(c).use{db->db.update{root->
   require(root.optString("owner").let{if(it=="null")"" else it}==owner){"Account changed"}
   val data=items(c,root);val rows=root.optJSONArray("records")?:JSONArray();val records=(0 until rows.length()).map{rows.getJSONObject(it)};val settings=root.getJSONObject("settings");val today=LocalDate.now(ZoneId.of(settings.getString("timezone"))).toString()
   val plan=SecretRules.plan(data,records,habitId,day,state,today,UUID.randomUUID().toString(),settings.getString("timezone"))
   for(item in plan.privateItems)NativeRecords.put(root,"private_records",item.getString("id"),JSONObject().put("sealed",DeenPrivacy.seal(c,item.toString())).put("format","aes-gcm-device-v1"))
   for(record in plan.publicRecords)NativeRecords.put(root,record.getString("entity"),record.getString("id"),record.getJSONObject("data"),record.optBoolean("deleted"))
   val merged=data.filter{x->plan.privateItems.none{it.getString("id")==x.getString("id")}}+plan.privateItems
   val latest=root.getJSONArray("records");settings.put("privatePenaltyReminders",PenaltyRules.schedules(merged,(0 until latest.length()).map{latest.getJSONObject(it)}))
   val habits=merged.filter{it.optString("type")=="habit"&&!it.optBoolean("archived")&&it.optString("start")<=today}
   settings.put("privateCheckinDoneDay",if(habits.isNotEmpty()&&habits.all{h->merged.any{it.optString("type")=="checkin"&&it.optString("habitId")==h.getString("id")&&it.optString("day")==today&&it.optString("state") in listOf("avoided","slipped")}})today else "")
   changed=plan.changed;root
  }}
  NativeSignals.changed(c);ReminderMaintenance.request(c,true);return changed
 }
 fun completeCharity(c:Context,owner:String,id:String):Boolean {
  var changed=false
  LocalDatabase(c).use{db->db.update{root->
   require(root.optString("owner").let{if(it=="null")"" else it}==owner){"Account changed"}
   val data=items(c,root);val task=data.firstOrNull{it.optString("id")==id&&it.optString("type")=="recovery"&&it.optString("kind")=="charity"}?:error("Charity penalty not found")
   require(task.optString("state") in listOf("pending","done")){"This penalty was dismissed"}
   if(task.optString("state")=="pending"){
    task.put("state","done").put("completedAt",Instant.now().toString())
    NativeRecords.put(root,"private_records",id,JSONObject().put("sealed",DeenPrivacy.seal(c,task.toString())).put("format","aes-gcm-device-v1"));changed=true
   }
   val rows=root.getJSONArray("records");root.getJSONObject("settings").put("privatePenaltyReminders",PenaltyRules.schedules(data,(0 until rows.length()).map{rows.getJSONObject(it)}));root
  }}
  NativeSignals.changed(c);ReminderMaintenance.request(c,true);return changed
 }

}
