package org.salahguard.app
import org.json.*
import java.time.Instant
import java.util.UUID
import java.security.SecureRandom
object CollectibleRules {
 private val random=SecureRandom()
 val rarities=listOf("common","uncommon","rare","ultra")
 fun empty()=JSONObject().put("version",1).put("library",JSONObject()).put("copies",JSONObject()).put("packs",JSONObject()).put("artwork",JSONObject())
 fun verified(c:JSONObject)=Regex("[a-f0-9-]{36}").matches(c.optString("id"))&&c.optString("rarity") in rarities&&c.optInt("edition")>=2&&c.optBoolean("englishReviewed")&&c.optBoolean("urduReviewed")&&c.optString("verification")=="verified"&&c.optString("status")=="published"&&c.optBoolean("artVerified")&&Regex("[a-f0-9-]{36}").matches(c.optString("artId"))&&c.opt("title") is String&&c.opt("story") is String&&c.optJSONArray("references")?.let{refs->refs.length() in 1..8&&(0 until refs.length()).all{i->val ref=refs.optJSONObject(i);ref?.opt("title") is String&&runCatching{val uri=java.net.URI(ref.optString("url"));uri.scheme=="https"&&!uri.host.isNullOrEmpty()&&uri.userInfo==null}.getOrDefault(false)}}==true
 fun select(library:List<JSONObject>,weights:JSONObject=JSONObject("{\"common\":55,\"uncommon\":30,\"rare\":12,\"ultra\":3}"),draw:(Int,Int)->Int={min,max->min+random.nextInt(max-min+1)}):List<JSONObject>{
  require(weights.keys().asSequence().toSet()==rarities.toSet()&&rarities.sumOf{weights.optInt(it)}==100&&rarities.all{weights.optInt(it)>0}){"Invalid rarity configuration"}
  val pools=rarities.associateWith{rarity->library.filter{verified(it)&&it.optString("rarity")==rarity}.distinctBy{it.getString("id")}.toMutableList()};require(pools.values.all{it.size>=3}){"The verified card library is still being prepared. No Gems were spent."}
  return (0..2).map{val roll=draw(1,100);require(roll in 1..100);var ceiling=0;val rarity=rarities.first{ceiling+=weights.getInt(it);roll<=ceiling};val pool=pools.getValue(rarity);val index=draw(0,pool.size-1);require(index in pool.indices);pool.removeAt(index)}
 }
 fun cacheLibrary(root:JSONObject,rows:JSONArray,availability:JSONArray=JSONArray()){
  val state=root.optJSONObject("collectibles")?:empty();val library=state.getJSONObject("library")
  val owned=state.getJSONObject("copies").let{copies->copies.keys().asSequence().map{copies.getJSONObject(it).optString("cardId")}.toSet()};library.keys().asSequence().toList().filter{it !in owned}.forEach{library.getJSONObject(it).put("status","unavailable")}
  for(i in 0 until rows.length()){val card=rows.getJSONObject(i);require(verified(card)){"Unverified card refused"};val merged=library.optJSONObject(card.getString("id"))?:JSONObject();card.keys().forEach{key->merged.put(key,card.get(key))};library.put(card.getString("id"),merged)}
  for(i in 0 until availability.length()){val row=availability.getJSONObject(i);val card=library.optJSONObject(row.optString("id"))?:continue;val verified=row.optBoolean("verified")||row.optString("verified")=="1";card.put("status",if(verified&&row.optString("status") in listOf("flagged","withdrawn"))row.getString("status")else "unavailable")}
  val copies=state.getJSONObject("copies");copies.keys().asSequence().forEach{val copy=copies.getJSONObject(it);copy.put("hidden",library.optJSONObject(copy.optString("cardId"))?.optString("status") !in listOf("published","flagged"))}
  root.put("collectibles",state)
 }
 fun reserve(root:JSONObject,id:String){
  require(Regex("[a-f0-9-]{36}").matches(id));val state=root.optJSONObject("collectibles")?:empty();val reservations=state.optJSONObject("reservations")?:JSONObject()
  if(reservations.has(id)||state.getJSONObject("packs").has(id))return
  GemRules.reconcile(root);val economy=root.getJSONObject("economy");val cost=economy.optJSONObject("prices")?.optInt("pack",500)?:500;require(economy.optLong("balance")>=cost){"Not enough Gems"}
  val library=state.getJSONObject("library");val selected=select(library.keys().asSequence().map{library.getJSONObject(it)}.toList(),economy.optJSONObject("rarities")?:JSONObject("{\"common\":55,\"uncommon\":30,\"rare\":12,\"ultra\":3}"))
  reservations.put(id,JSONObject().put("cardIds",JSONArray(selected.map{it.getString("id")})).put("cost",cost));state.put("reservations",reservations);root.put("collectibles",state)
 }
 fun purchase(root:JSONObject,id:String,now:Instant=Instant.now(),draw:(Int,Int)->Int={min,max->min+random.nextInt(max-min+1)}):JSONObject{
  require(Regex("[a-f0-9-]{36}").matches(id)){"Invalid pack identifier"};GemRules.reconcile(root,now)
  val economy=root.getJSONObject("economy");val state=root.optJSONObject("collectibles")?:empty();val orders=economy.optJSONObject("orders")?:JSONObject();val prior=orders.optJSONObject(id)
  if(prior!=null){require(prior.optString("kind")=="pack"&&state.getJSONObject("packs").has(id)){"This purchase identifier was already used"};return state}
  val cost=(economy.optJSONObject("prices")?.optInt("pack",500)?:500).coerceIn(1,100000);require(economy.optLong("balance")>=cost){"Not enough Gems"}
  val library=state.getJSONObject("library");val reservation=state.optJSONObject("reservations")?.optJSONObject(id)
  require(reservation==null||reservation.getInt("cost")==cost){"The pack price changed. No Gems were spent."}
  val chosen=reservation?.getJSONArray("cardIds")?.let{rows->(0 until rows.length()).map{library.getJSONObject(rows.getString(it))}}?:select(library.keys().asSequence().map{library.getJSONObject(it)}.toList(),economy.optJSONObject("rarities")?:JSONObject("{\"common\":55,\"uncommon\":30,\"rare\":12,\"ultra\":3}"),draw)
  require(chosen.size==3&&chosen.map{it.getString("id")}.distinct().size==3&&chosen.all{verified(it)&&it.optString("english").isNotBlank()&&it.optString("urdu").isNotBlank()}){"Connect to save the three complete stories before opening this pack. No Gems were spent."}
  val ids=JSONArray();val cardIds=JSONArray()
  chosen.forEachIndexed{position,card->val copy=UUID.randomUUID().toString();ids.put(copy);cardIds.put(card.getString("id"));state.getJSONObject("copies").put(copy,JSONObject().put("id",copy).put("cardId",card.getString("id")).put("orderId",id).put("position",position).put("acquiredAt",now.toString()).put("revealed",false).put("pendingSync",true))}
  state.getJSONObject("packs").put(id,JSONObject().put("id",id).put("copyIds",ids).put("createdAt",now.toString()).put("pendingSync",true));root.put("collectibles",state)
  economy.put("balance",economy.optLong("balance")-cost);orders.put(id,JSONObject().put("id",id).put("kind","pack").put("cost",cost).put("payload",JSONObject().put("cardIds",cardIds).put("copyIds",ids)).put("createdAt",now.toString()).put("status","pending"));economy.put("orders",orders)
  val key="order:$id";economy.getJSONObject("transactions").put(key,JSONObject().put("id",key).put("source",key).put("kind","pack").put("delta",-cost).put("at",now.toString()).put("balanceAfter",economy.getLong("balance")));return state
 }
 fun reveal(root:JSONObject,copy:String){val c=root.optJSONObject("collectibles")?.optJSONObject("copies")?.optJSONObject(copy)?:error("Card copy not found");if(!c.optBoolean("revealed"))c.put("revealed",true).put("revealSynced",false)}
 fun mergeCollection(root:JSONObject,data:JSONObject){
  val state=root.optJSONObject("collectibles")?:empty();val library=state.getJSONObject("library");val copies=state.getJSONObject("copies");val packs=state.getJSONObject("packs");val rows=data.optJSONArray("copies")?:JSONArray();val grouped=linkedMapOf<String,MutableList<JSONObject>>()
  for(i in 0 until rows.length()){
   val row=rows.getJSONObject(i);val card=row.getJSONObject("card");require(card.optString("verification")=="verified"){"Unverified collection content refused"};val merged=library.optJSONObject(card.getString("id"))?:JSONObject();card.keys().forEach{key->merged.put(key,card.get(key))};library.put(card.getString("id"),merged)
   val id=row.getString("copyId");val old=copies.optJSONObject(id);val revealed=row.optBoolean("revealed")||old?.optBoolean("revealed")==true
   val copy=JSONObject().put("id",id).put("cardId",card.getString("id")).put("orderId",row.getString("orderId")).put("position",row.getInt("position")).put("acquiredAt",row.getString("acquiredAt")).put("revealed",revealed).put("revealSynced",row.optBoolean("revealed")).put("pendingSync",false).put("hidden",false);copies.put(id,copy);grouped.getOrPut(row.getString("orderId")){mutableListOf()}.add(copy)
  }
  for((id,items) in grouped){val old=packs.optJSONObject(id);packs.put(id,JSONObject().put("id",id).put("copyIds",JSONArray(items.sortedBy{it.getInt("position")}.map{it.getString("id")})).put("createdAt",old?.optString("createdAt")?:items.first().getString("acquiredAt")).put("opened",old?.optBoolean("opened")?:false).put("pendingSync",false))}
  val hidden=data.optJSONArray("hiddenCopyIds")?:JSONArray();for(i in 0 until hidden.length())run{val copy=copies.optJSONObject(hidden.getString(i));if(copy!=null){copy.put("hidden",true).put("pendingSync",false);library.optJSONObject(copy.optString("cardId"))?.put("status","unavailable")}}
  root.put("collectibles",state)
 }

}
