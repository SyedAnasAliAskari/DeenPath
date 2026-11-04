package org.salahguard.app
import org.json.*
import java.time.Instant
/** Offline counterpart of GemRules.php. Reward claims come only from completion records. */
object GemRules {
 val defaults=JSONObject("{\"prayer\":10,\"qaza\":8,\"tasbih\":5,\"dua\":5,\"custom\":5}")
 fun sources(records:List<JSONObject>,now:Long):Map<String,String>{
  val out=linkedMapOf<String,String>()
  fun at(value:String)=runCatching{Instant.parse(value).toEpochMilli()}.getOrNull()
  fun valid(value:String)=at(value)?.let{it<=now+300000}?:false
  for(r in records.filter{!it.optBoolean("deleted")}){
   val d=r.optJSONObject("data")?:continue;val id=r.optString("id")
   when(r.optString("entity")){
    "prayer_records"->{
     if(!Regex("\\d{4}-\\d{2}-\\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)").matches(id)||id!=d.optString("day")+":"+d.optString("prayer")||d.optString("status")=="na")continue
     val start=at(d.optString("windowStart"))?:continue;val end=at(d.optString("windowEnd"))?:continue;if(end<=start)continue
     val completed=at(d.optString("completedAt"));val qaza=at(d.optString("qazaAt"))
     if(completed!=null&&completed<=now+300000&&completed>=start&&completed<end)out["prayer:$id"]="prayer"
     else if(qaza!=null&&qaza<=now+300000&&qaza>=end)out["prayer:$id"]="qaza"
    }
    "qaza_history"->{val items=d.optJSONArray("completed")?:JSONArray();val seen=mutableSetOf<String>();val count=d.optInt("quantity").coerceIn(0,100000);var earned=0
     for(i in 0 until items.length()){val item=items.optJSONObject(i)?:continue;val key=item.optString("id");if(key.isEmpty()||!valid(item.optString("at"))||!seen.add(key))continue
      val value=item.opt("quantity")?:1;val quantity=if(value is Number&&value.toDouble()==value.toInt().toDouble())value.toInt().coerceIn(0,count-earned)else 0
      for(unit in 0 until quantity)out["historical:$id:$key:$unit"]="qaza";earned+=quantity;if(earned>=count)break
     }
    }
    "routine_completions"->{
     if(id!=d.optString("routineId")+":"+d.optString("period")||!valid(d.optString("completedAt")))continue
     val routine=records.firstOrNull{it.optString("entity")=="routines"&&it.optString("id")==d.optString("routineId")}
     val kind=routine?.optJSONObject("data")?.optString("kind")
     if(kind in listOf("tasbih","dua","custom","quran","nafl"))out["routine:$id"]=if(kind in listOf("tasbih","dua"))kind!! else "custom"
    }
   }
  };return out
 }
 fun reconcile(root:JSONObject,now:Instant=Instant.now(),rewards:JSONObject=root.optJSONObject("economy")?.optJSONObject("rewardValues")?:defaults):JSONObject {
  val rows=root.optJSONArray("records")?:return root
  val records=(0 until rows.length()).map{rows.getJSONObject(it)};val sources=sources(records,now.toEpochMilli())
  val state=root.optJSONObject("economy")?:JSONObject().put("version",1).put("balance",0).put("claims",JSONObject()).put("transactions",JSONObject())
  val claims=state.optJSONObject("claims")?:JSONObject();val ledger=state.optJSONObject("transactions")?:JSONObject();var balance=state.optLong("balance")
  for(source in claims.keys().asSequence().toSet()+sources.keys){
   val kind=sources[source];val old=claims.optJSONObject(source);val rates=old?.optJSONObject("rates")?:JSONObject()
   if(kind!=null&&!rates.has(kind))rates.put(kind,rewards.optInt(kind).coerceIn(0,10000))
   val amount=if(kind!=null)rates.getInt(kind) else 0;val before=if(old?.optBoolean("active")==true)old.optInt("amount")else 0
   if(amount==before&&(kind==null||old?.optString("kind")==kind))continue
   val revision=(old?.optInt("revision")?:0)+1;val delta=amount-before;val id="$source:$revision";balance+=delta
   claims.put(source,JSONObject().put("kind",kind?:old!!.getString("kind")).put("amount",amount).put("active",kind!=null).put("revision",revision).put("rates",rates))
   ledger.put(id,JSONObject().put("id",id).put("source",source).put("kind",kind?:"correction").put("delta",delta).put("at",now.toString()).put("balanceAfter",balance))
  }
  root.put("economy",state.put("balance",balance).put("claims",claims).put("transactions",ledger));return root
 }
}
