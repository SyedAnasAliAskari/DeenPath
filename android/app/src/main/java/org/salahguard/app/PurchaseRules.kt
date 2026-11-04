package org.salahguard.app
import org.json.*
object PurchaseRules {
 fun replay(root:JSONObject,order:JSONObject){
  val state=root.getJSONObject("economy");val id=order.getString("id");val orders=state.optJSONObject("orders")?:JSONObject();if(orders.has(id))return
  val cost=order.getInt("cost");require(cost in 0..100000){"Invalid purchase cost"};require(cost==0||state.optLong("balance")>=cost){"This offline purchase needs attention because the cloud balance changed."}
  val kind=order.getString("kind");val payload=order.getJSONObject("payload")
  if(kind=="pack")for(key in listOf("cardIds","copyIds")){val rows=payload.getJSONArray(key);val values=(0 until rows.length()).map{rows.getString(it)};require(values.size==3&&values.distinct().size==3&&values.all{Regex("[a-f0-9-]{36}").matches(it)}){"Invalid saved pack"}}
  else{val clean=ThemeRules.clean(kind,payload);state.put("theme",ThemeRules.apply(state.optJSONObject("theme")?:JSONObject(),kind,clean));state.put("studioUnlocked",state.optBoolean("studioUnlocked")||kind=="unlock")}
  state.put("balance",state.optLong("balance")-cost).put("orders",orders);orders.put(id,order)
  val key="order:$id";state.getJSONObject("transactions").put(key,JSONObject().put("id",key).put("source",key).put("kind",if(kind=="pack")"pack" else "purchase").put("delta",-cost).put("at",order.getString("createdAt")).put("balanceAfter",state.getLong("balance")))
 }
}
