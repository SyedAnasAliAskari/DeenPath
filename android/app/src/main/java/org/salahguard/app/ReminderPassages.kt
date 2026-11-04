package org.salahguard.app
import android.content.Context
import org.json.*

object PassageRotation {
 fun pick(bank:JSONArray,theme:String,sequence:Long,previous:String):JSONObject {
  val all=(0 until bank.length()).map{bank.getJSONObject(it)}
  val selected=all.filter{ row->theme=="balanced"||(0 until row.getJSONArray("themes").length()).any{row.getJSONArray("themes").getString(it)==theme} }.ifEmpty{all}
  require(selected.isNotEmpty())
  var index=Math.floorMod(sequence,selected.size.toLong()).toInt()
  if(selected.size>1&&selected[index].getString("id")==previous)index=(index+1)%selected.size
  return selected[index]
 }
 fun hadith(row:JSONObject,language:String):String = listOf(
   row.optString("arabicExcerpt"),
   if(language=="en"||language=="both")"English · Meaning (summary)\n"+row.optString("enSummary")else "",
   if(language=="ur"||language=="both")"اردو · مفہوم کا خلاصہ\n"+row.optString("urSummary")else "",
   row.getString("ref")+" · Sahih · Arabic excerpt\n"+row.getString("source")
 ).filter{it.isNotBlank()}.joinToString("\n\n")
}
object ReminderPassages {
 @Volatile private var cached:JSONArray?=null
 private fun bank(c:Context)=cached?:JSONObject(c.assets.open("reminder-passages.json").bufferedReader().use{it.readText()}).getJSONArray("entries").also{cached=it}
 fun prepare(c:Context,event:JSONObject,settings:JSONObject) {
  if(!event.optString("route").startsWith("prayer:")&&!event.optBoolean("testOverlay"))return
  synchronized(LocalDatabase.snapshotLock){LocalDatabase(c).use{db->
   val rows=bank(c);val previousEvent=runCatching{JSONObject(db.meta("reminder.event:"+event.optString("route"))?:"")}.getOrNull()
   val existing=previousEvent?.takeIf{it.optString("id")==event.optString("id")}?.optString("contentId")
   var row=(0 until rows.length()).map{rows.getJSONObject(it)}.firstOrNull{it.optString("id")==existing}
   if(row==null){
    val key="reminder.reading:"+event.optString("owner")
    val state=runCatching{JSONObject(db.meta(key)?:"{}")}.getOrDefault(JSONObject())
    row=PassageRotation.pick(rows,settings.optString("reminderTheme","balanced"),state.optLong("sequence"),state.optString("last"))
    db.meta(key,JSONObject().put("sequence",state.optLong("sequence")+1).put("last",row.getString("id")).toString())
   }
   event.put("contentId",row.getString("id")).put("contentKind",row.getString("kind"))
    .put("body",if(row.getString("kind")=="quran")NativeContent.reminder(c,row.getString("ref"),NativeContent.language(settings))else PassageRotation.hadith(row,NativeContent.language(settings)))
  }}
 }
}
