package org.salahguard.app

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/** The versioned snapshot and its indexed projections commit in ONE SQLite transaction. */
class LocalDatabase(context: Context, databaseName:String="salahguard.db") : SQLiteOpenHelper(context, databaseName, null, 5) {
  private val appContext = context.applicationContext
  companion object {
    val snapshotLock = Any()
  }

  override fun onConfigure(db: SQLiteDatabase) {
    db.setForeignKeyConstraintsEnabled(true)
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE snapshots(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)")
    db.execSQL(
      "CREATE TABLE records(entity TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,deleted INTEGER NOT NULL,PRIMARY KEY(entity,id))"
    )
    db.execSQL(
      "CREATE TABLE operations(id TEXT PRIMARY KEY,entity TEXT NOT NULL,record_id TEXT NOT NULL,payload TEXT NOT NULL,attempts INTEGER NOT NULL,next_try INTEGER NOT NULL)"
    )
    db.execSQL(
      "CREATE TABLE reminders(id TEXT PRIMARY KEY,at INTEGER NOT NULL,payload TEXT NOT NULL)"
    )
    db.execSQL("CREATE INDEX reminder_due ON reminders(at)")
    db.execSQL(
      "CREATE TABLE reading_positions(path TEXT PRIMARY KEY,page INTEGER NOT NULL DEFAULT 0)"
    )
    db.execSQL("CREATE TABLE native_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)")
    db.execSQL(
      "CREATE TABLE schema_metadata(version INTEGER PRIMARY KEY, description TEXT NOT NULL)"
    )
    db.execSQL("INSERT INTO schema_metadata VALUES(4,'DeenPath additive encrypted records')")
    db.execSQL("CREATE TABLE IF NOT EXISTS owned_card_texts(card_id TEXT PRIMARY KEY,version INTEGER NOT NULL,value TEXT NOT NULL)")
    db.execSQL("INSERT INTO schema_metadata VALUES(5,'Separate retained owned card stories')")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if(oldVersion<5){db.execSQL("CREATE TABLE IF NOT EXISTS owned_card_texts(card_id TEXT PRIMARY KEY,version INTEGER NOT NULL,value TEXT NOT NULL)");db.execSQL("CREATE TABLE IF NOT EXISTS schema_metadata(version INTEGER PRIMARY KEY, description TEXT NOT NULL)");db.execSQL("INSERT OR IGNORE INTO schema_metadata VALUES(5,'Separate retained owned card stories')")}
    if (oldVersion < 4)
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS schema_metadata(version INTEGER PRIMARY KEY, description TEXT NOT NULL)"
      )
    if (oldVersion < 4)
      db.execSQL(
        "INSERT OR IGNORE INTO schema_metadata VALUES(4,'DeenPath additive encrypted records')"
      )
    if (oldVersion < 3)
      db.execSQL("CREATE TABLE IF NOT EXISTS native_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)")
    if (oldVersion < 2)
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS reading_positions(path TEXT PRIMARY KEY,page INTEGER NOT NULL DEFAULT 0)"
      )
  }

  fun cardStory(id:String):JSONObject?=readableDatabase.rawQuery("SELECT value FROM owned_card_texts WHERE card_id=?",arrayOf(id)).use{if(it.moveToFirst())JSONObject(it.getString(0))else null}

  fun load(): String =
    readableDatabase.rawQuery("SELECT value FROM snapshots WHERE id=1", null).use {
      if (it.moveToFirst()) it.getString(0) else ""
    }

  @Synchronized
  fun save(raw: String) {
    val root = JSONObject(raw)
    val db = writableDatabase
    db.beginTransaction()
    try {
      val library=root.optJSONObject("collectibles")?.optJSONObject("library")
      library?.keys()?.asSequence()?.toList()?.forEach{id->val card=library.getJSONObject(id)
        if(card.optString("verification")=="verified"&&card.optString("english").isNotBlank()&&card.optString("urdu").isNotBlank()){
          val old=cardStory(id);if(old==null||old.optInt("version")<=card.optInt("version"))db.execSQL("INSERT OR REPLACE INTO owned_card_texts(card_id,version,value) VALUES(?,?,?)",arrayOf<Any>(id,card.optInt("version"),card.toString()))
          card.remove("english");card.remove("urdu")
        }
      }
      db.execSQL("INSERT OR REPLACE INTO snapshots(id,value) VALUES(1,?)", arrayOf(root.toString()))
      db.execSQL("DELETE FROM records")
      db.execSQL("DELETE FROM operations")
      val records = root.getJSONArray("records")
      for (i in 0 until records.length()) {
        val r = records.getJSONObject(i)
        db.execSQL(
          "INSERT INTO records(entity,id,data,version,deleted) VALUES(?,?,?,?,?)",
          arrayOf<Any>(
            r.getString("entity"),
            r.getString("id"),
            r.getJSONObject("data").toString(),
            r.getInt("version"),
            if (r.optBoolean("deleted")) 1 else 0,
          ),
        )
      }
      val ops = root.getJSONArray("queue")
      for (i in 0 until ops.length()) {
        val o = ops.getJSONObject(i)
        val r = o.getJSONObject("record")
        db.execSQL(
          "INSERT INTO operations(id,entity,record_id,payload,attempts,next_try) VALUES(?,?,?,?,?,?)",
          arrayOf<Any>(
            o.getString("id"),
            r.getString("entity"),
            r.getString("id"),
            o.toString(),
            o.getInt("attempts"),
            o.getLong("nextTry"),
          ),
        )
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
    WidgetUpdates.request(appContext)
  }

  fun update(transform: (JSONObject) -> JSONObject): JSONObject =
    synchronized(snapshotLock) {
      val original = load()
      val current = SnapshotDocument.parse(original)
      val next = GemRules.reconcile(transform(current))
      save(next.toString())
      next
    }

  fun mergeSave(raw: String, base: String): JSONObject = update { current ->
    if (current.length() == 0) JSONObject(raw)
    else
      SnapshotMerge.combine(
        if (base.isEmpty()) JSONObject() else JSONObject(base),
        JSONObject(raw),
        current,
      ).also { merged ->
        // Only the native serialized writer owns the derived ledger. Stale WebViews cannot replace it.
        if(current.has("economy"))merged.put("economy",current.getJSONObject("economy"))
        else merged.remove("economy")
        if(current.has("collectibles"))merged.put("collectibles",current.getJSONObject("collectibles"))
      }
  }

  fun hasDueReminder(now: Long): Boolean =
    readableDatabase.rawQuery("SELECT 1 FROM reminders WHERE at<=? LIMIT 1", arrayOf(now.toString())).use { it.moveToFirst() }

  fun reminderList(): List<JSONObject> =
    readableDatabase.rawQuery("SELECT payload FROM reminders", null).use { c ->
      buildList { while (c.moveToNext()) add(JSONObject(c.getString(0))) }
    }

  fun putReminder(r: JSONObject) {
    writableDatabase.execSQL(
      "INSERT OR REPLACE INTO reminders(id,at,payload) VALUES(?,?,?)",
      arrayOf<Any>(r.getString("id"), r.getLong("at"), r.toString()),
    )
  }

  fun clearReminders() {
    writableDatabase.execSQL("DELETE FROM reminders")
  }

  fun removeReminder(id: String) {
    writableDatabase.execSQL("DELETE FROM reminders WHERE id=?", arrayOf(id))
  }

  fun replaceReminders(rows: List<JSONObject>) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.execSQL("DELETE FROM reminders")
      rows.forEach { putReminder(it) }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  fun meta(key: String): String? =
    readableDatabase.rawQuery("SELECT value FROM native_meta WHERE key=?", arrayOf(key)).use {
      if (it.moveToFirst()) it.getString(0) else null
    }

  fun meta(key: String, value: String) {
    writableDatabase.execSQL(
      "INSERT OR REPLACE INTO native_meta(key,value) VALUES(?,?)",
      arrayOf(key, value),
    )
  }

  fun position(path: String): Int =
    readableDatabase
      .rawQuery("SELECT page FROM reading_positions WHERE path=?", arrayOf(path))
      .use { if (it.moveToFirst()) it.getInt(0) else 0 }

  fun position(path: String, page: Int) {
    writableDatabase.execSQL(
      "INSERT OR REPLACE INTO reading_positions(path,page) VALUES(?,?)",
      arrayOf<Any>(path, page),
    )
  }
}
