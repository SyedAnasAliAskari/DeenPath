package org.salahguard.app
import android.database.sqlite.SQLiteOpenHelper
import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
@RunWith(AndroidJUnit4::class)
class CardStoryStorageTest {
 @Test fun versionFourUpgradeAndSeparateStoriesPreserveOwnedText(){
  val app=InstrumentationRegistry.getInstrumentation().targetContext;val name="qa-card-stories-${UUID.randomUUID()}.db";val id=UUID.randomUUID().toString()
  val card=JSONObject().put("id",id).put("version",2).put("verification","verified").put("status","published").put("english","A synthetic story without historical claims. ".repeat(80)).put("urdu","یہ جانچ کے لیے ایک آزمائشی کہانی ہے۔ ".repeat(80))
  val root=JSONObject().put("schema",1).put("records",JSONArray()).put("queue",JSONArray()).put("settings",JSONObject()).put("collectibles",CollectibleRules.empty().apply{getJSONObject("library").put(id,card);getJSONObject("copies").put("copy",JSONObject().put("cardId",id))})
  try{
   object:SQLiteOpenHelper(app,name,null,4){override fun onCreate(db:SQLiteDatabase){
    db.execSQL("CREATE TABLE snapshots(id INTEGER PRIMARY KEY,value TEXT NOT NULL)");db.execSQL("CREATE TABLE records(entity TEXT,id TEXT,data TEXT,version INTEGER,deleted INTEGER)");db.execSQL("CREATE TABLE operations(id TEXT PRIMARY KEY,entity TEXT,record_id TEXT,payload TEXT,attempts INTEGER,next_try INTEGER)");db.execSQL("CREATE TABLE reading_positions(path TEXT PRIMARY KEY,page INTEGER)");db.execSQL("INSERT INTO reading_positions VALUES('synthetic-document',12)");db.execSQL("CREATE TABLE native_meta(key TEXT PRIMARY KEY,value TEXT)");db.execSQL("CREATE TABLE schema_metadata(version INTEGER PRIMARY KEY,description TEXT)");db.execSQL("INSERT INTO snapshots VALUES(1,?)",arrayOf(root.toString()))
   };override fun onUpgrade(db:SQLiteDatabase,old:Int,new:Int){error("Unexpected upgrade")}}.use{it.writableDatabase}
   LocalDatabase(app,name).use{db->assertEquals(5,db.writableDatabase.version);assertEquals(root.toString(),db.load());db.update{it};assertFalse(JSONObject(db.load()).getJSONObject("collectibles").getJSONObject("library").getJSONObject(id).has("english"));assertEquals(card.getString("english"),db.cardStory(id)!!.getString("english"));db.readableDatabase.rawQuery("SELECT page FROM reading_positions",null).use{assertTrue(it.moveToFirst());assertEquals(12,it.getInt(0))}}
   LocalDatabase(app,name).use{db->db.update{it};assertEquals(card.getString("urdu"),db.cardStory(id)!!.getString("urdu"));assertEquals(1,JSONObject(db.load()).getJSONObject("collectibles").getJSONObject("copies").length())}
  }finally{app.deleteDatabase(name)}
 }
 @Test fun counterCommitsDoNotWaitForReminderPlanning(){
  val app=InstrumentationRegistry.getInstrumentation().targetContext;val name="qa-counter-speed-${UUID.randomUUID()}.db";val samples=mutableListOf<Long>()
  try{LocalDatabase(app,name).use{db->val records=JSONArray();for(i in 0..54)records.put(JSONObject().put("entity","tasbih_progress").put("id","synthetic-$i").put("version",0).put("deleted",false).put("data",JSONObject().put("count",0)));db.save(JSONObject().put("schema",1).put("records",records).put("queue",JSONArray()).put("settings",JSONObject()).toString());for(i in 1..12){val start=android.os.SystemClock.elapsedRealtime();db.update{root->root.getJSONArray("records").getJSONObject(0).getJSONObject("data").put("count",i);root};samples.add(android.os.SystemClock.elapsedRealtime()-start)};assertEquals(12,JSONObject(db.load()).getJSONArray("records").getJSONObject(0).getJSONObject("data").getInt("count"))};val sorted=samples.sorted();java.io.File(app.cacheDir,"qa-counter-speed.json").writeText(JSONObject().put("samplesMs",JSONArray(samples)).put("medianMs",sorted[sorted.size/2]).put("maxMs",sorted.last()).toString());assertTrue("Isolated local commit stalled: $samples",sorted.last()<2000)}finally{app.deleteDatabase(name)}
 }

}
