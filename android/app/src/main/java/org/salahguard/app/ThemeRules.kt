package org.salahguard.app
import org.json.*
import java.time.Instant
object ThemeRules {
 val prices=JSONObject("{\"unlock\":1000,\"colors\":50,\"wallpaper\":100,\"seasonal\":200,\"animated\":300,\"default\":0}")
 fun clean(kind:String,payload:JSONObject):JSONObject {
  require(prices.has(kind)){"Unknown customization"}
  if(kind in listOf("unlock","default"))return JSONObject()
  if(kind=="colors"){val out=JSONObject();for(key in listOf("primary","secondary")){val v=payload.optString(key);require(Regex("#[a-fA-F0-9]{6}").matches(v)){"Choose valid colors"};out.put(key,v.lowercase())};return out}
  if(kind=="wallpaper"){
   if(payload.has("fileId")){val id=payload.getString("fileId");require(Regex("[a-f0-9-]{36}").matches(id)){"Invalid wallpaper file"};return JSONObject().put("fileId",id)}
   require(payload.optString("wallpaper") in listOf("sand","garden","night")){"Choose a wallpaper"};return JSONObject().put("wallpaper",payload.getString("wallpaper"))
  }
  if(kind=="seasonal"){require(payload.optString("seasonal") in listOf("ramadan","eid")){"Choose a seasonal theme"};return JSONObject().put("seasonal",payload.getString("seasonal"))}
  val rows=payload.optJSONArray("effects")?:error("Choose effects");val effects=(0 until rows.length()).map{rows.getString(it)}
  require(effects.size in 1..4&&effects.distinct().size==effects.size&&effects.all{it in listOf("stars","lanterns","clouds","geometry")}){"Choose one or more effects"}
  return JSONObject().put("effects",JSONArray(effects.sorted()))
 }
 fun apply(old:JSONObject,kind:String,payload:JSONObject):JSONObject {
  if(kind=="default")return JSONObject();val out=JSONObject(old.toString())
  when(kind){
   "colors"->for(key in listOf("primary","secondary"))out.put(key,payload.getString(key))
   "wallpaper"->out.put("wallpaper",payload)
   "seasonal"->out.put("wallpaper",JSONObject().put("wallpaper",payload.getString("seasonal"))).put("primary",if(payload.getString("seasonal")=="ramadan")"#245858" else "#573c76").put("secondary","#b28b34")
   "animated"->out.put("effects",payload.getJSONArray("effects"))
  };return out
 }
 fun purchase(root:JSONObject,id:String,kind:String,input:JSONObject,now:Instant=Instant.now()):JSONObject {
  require(Regex("[a-f0-9-]{36}").matches(id)){"Invalid purchase identifier"};val payload=clean(kind,input);GemRules.reconcile(root,now)
  val state=root.getJSONObject("economy");val orders=state.optJSONObject("orders")?:JSONObject();val prior=orders.optJSONObject(id)
  if(prior!=null){require(prior.optString("kind")==kind&&prior.getJSONObject("payload").toString()==payload.toString()){"This purchase identifier was already used"};return state}
  require(kind in listOf("default","unlock")||state.optBoolean("studioUnlocked")){"Unlock Theme Studio first"}
  require(kind!="unlock"||!state.optBoolean("studioUnlocked")){"Theme Studio is already unlocked"}
  val cost=if(kind=="default")0 else (state.optJSONObject("prices")?.optInt(kind,prices.getInt(kind))?:prices.getInt(kind)).coerceIn(0,100000)
  require(cost==0||state.optLong("balance")>=cost){"Not enough Gems"}
  val balance=state.optLong("balance")-cost;state.put("balance",balance).put("studioUnlocked",state.optBoolean("studioUnlocked")||kind=="unlock")
  state.put("theme",apply(state.optJSONObject("theme")?:JSONObject(),kind,payload))
  orders.put(id,JSONObject().put("id",id).put("kind",kind).put("payload",payload).put("cost",cost).put("createdAt",now.toString()).put("status","pending"));state.put("orders",orders)
  val key="order:$id";state.getJSONObject("transactions").put(key,JSONObject().put("id",key).put("source",key).put("kind","purchase").put("delta",-cost).put("at",now.toString()).put("balanceAfter",balance));return state
 }
}
