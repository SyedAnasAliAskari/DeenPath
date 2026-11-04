package org.salahguard.app

import android.content.Context
import androidx.work.*
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import org.json.JSONArray
import org.json.JSONObject

object NativeRecords {
  fun put(
    root: JSONObject,
    entity: String,
    id: String,
    data: JSONObject,
    deleted: Boolean = false,
  ) {
    val records = root.optJSONArray("records") ?: JSONArray()
    var version = 0
    var index = -1
    for (i in 0 until records.length()) {
      val r = records.getJSONObject(i)
      if (r.getString("entity") == entity && r.getString("id") == id) {
        version = r.optInt("version")
        index = i
        break
      }
    }
    val record =
      JSONObject()
        .put("entity", entity)
        .put("id", id)
        .put("data", data)
        .put("version", version)
        .put("deleted", deleted)
    if (index < 0) records.put(record) else records.put(index, record)
    root.put("records", records)
    val queue = root.optJSONArray("queue") ?: JSONArray()
    val op =
      JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("record", JSONObject(record.toString()))
        .put("attempts", 0)
        .put("nextTry", 0)
    var queued = -1
    for (i in 0 until queue.length()) {
      val o = queue.getJSONObject(i)
      val r = o.getJSONObject("record")
      if (o.optInt("attempts") == 0 && r.getString("entity") == entity && r.getString("id") == id) {
        queued = i
        break
      }
    }
    if (queued < 0) queue.put(op) else queue.put(queued, op)
    root.put("queue", queue)
  }

  fun record(root: JSONObject, entity: String, id: String): JSONObject? {
    val rows = root.optJSONArray("records") ?: return null
    for (i in 0 until rows.length()) {
      val r = rows.getJSONObject(i)
      if (r.optString("entity") == entity && r.optString("id") == id) return r
    }
    return null
  }
}

class SyncFailure(message: String, val retryable: Boolean = true,val status:Int=0) : IOException(message)

/**
 * HTTP work never holds a SQLite transaction. Every acknowledgement merges into the latest
 * snapshot.
 */
object SyncEngine {
  private val lock = ReentrantLock()
  private val identity = ThreadLocal<String>()

  private fun identityOf(root: JSONObject) =
    root.optString("owner") + "|" + (root.optJSONObject("settings")?.optString("api") ?: "")

  private fun checkOwner(root: JSONObject) {
    if (identity.get() != null && identity.get() != identityOf(root))
      throw SyncFailure("Account changed; synchronization stopped", false)
  }

  private fun root(c: Context) =
    LocalDatabase(c).use {
      val raw = it.load()
      if (raw.isEmpty()) JSONObject() else JSONObject(raw)
    }

  private fun syncGemEconomy(c:Context){
    try{
      val state=root(c);val orders=state.optJSONObject("economy")?.optJSONObject("orders")?:JSONObject()
      val pending=orders.keys().asSequence().map{orders.getJSONObject(it)}.filter{it.optString("status")=="pending"}.sortedBy{it.optString("createdAt")}.toList()
      if((state.optJSONArray("queue")?.length()?:0)==0)for(order in pending){
        val payload=JSONObject(order.getJSONObject("payload").toString())
        if(payload.has("fileId")){
          val rows=root(c).optJSONArray("localFiles")?:JSONArray();val file=(0 until rows.length()).map{rows.getJSONObject(it)}.firstOrNull{it.optString("id")==payload.optString("fileId")||it.optString("cloudId")==payload.optString("fileId")}
          if(file?.optString("cloudId").isNullOrEmpty())continue;payload.put("fileId",file!!.getString("cloudId"))
        }
        try{if(order.optString("kind")=="pack")request(c,"cards/import-pack",JSONObject().put("id",order.getString("id")).put("cardIds",payload.getJSONArray("cardIds")).put("copyIds",payload.getJSONArray("copyIds")).put("expectedCost",order.getInt("cost")))else request(c,"economy/purchase",JSONObject().put("id",order.getString("id")).put("kind",order.getString("kind")).put("payload",payload).put("expectedCost",order.getInt("cost")))}
        catch(e:SyncFailure){if(e.status!=422)throw e;save(c){r->r.getJSONObject("economy").getJSONObject("orders").getJSONObject(order.getString("id")).put("status","rejected").put("error",e.message);r}}
      }
      val canonical=request(c,"economy/reconcile",JSONObject())
      save(c){r->
        val local=r.optJSONObject("economy")?.optJSONObject("orders")?:JSONObject()
        val remaining=local.keys().asSequence().map{local.getJSONObject(it)}.sortedBy{it.optString("createdAt")}.toList()
        r.put("economy",canonical);GemRules.reconcile(r)
        for(order in remaining){val id=order.getString("id");val latest=r.getJSONObject("economy");val accepted=latest.optJSONObject("orders")?:JSONObject();latest.put("orders",accepted)
          if(accepted.has(id))continue
          if(order.optString("status")=="pending")try{PurchaseRules.replay(r,order)}catch(e:IllegalArgumentException){accepted.put(id,order.put("status","rejected").put("error",e.message))}
          else accepted.put(id,order)
        }
        r.remove("economySyncError");r
      }
      val collection=request(c,"cards/collection")
      save(c){r->CollectibleRules.mergeCollection(r,collection);r}
      val copies=root(c).optJSONObject("collectibles")?.optJSONObject("copies")?:JSONObject()
      val reveals=copies.keys().asSequence().filter{val item=copies.getJSONObject(it);item.optBoolean("revealed")&&!item.optBoolean("revealSynced")&&!item.optBoolean("pendingSync")}.take(100).toList()
      if(reveals.isNotEmpty()){
        request(c,"cards/reveal",JSONObject().put("copyIds",JSONArray(reveals)))
        save(c){r->for(id in reveals)r.optJSONObject("collectibles")?.optJSONObject("copies")?.optJSONObject(id)?.put("revealSynced",true);r}
      }
    }catch(e:Exception){save(c){it.put("economySyncError",e.message?:"Gems sync is pending")}}
  }

  private fun endpoint(c: Context, route: String): String {
    val state = root(c)
    checkOwner(state)
    val base = state.getJSONObject("settings").optString("api")
    val uri = runCatching { URI(base) }.getOrNull()
    if (
      uri?.scheme != "https" ||
        uri.host.isNullOrBlank() ||
        !uri.path.endsWith("/api.php") ||
        uri.userInfo != null
    )
      throw SyncFailure("Configure your HTTPS API URL in Settings first", false)
    return base + "?route=" + URLEncoder.encode("/v1/" + route, "UTF-8")
  }

  private fun connection(c: Context, route: String, method: String): HttpURLConnection {
    val conn = URI(endpoint(c, route)).toURL().openConnection() as HttpURLConnection
    conn.requestMethod = method
    conn.connectTimeout = 15000
    conn.readTimeout = 20000
    conn.instanceFollowRedirects = false
    conn.setRequestProperty("Accept", "application/json")
    conn.setRequestProperty("Authorization", "Bearer " + SecureVault(c).get())
    return conn
  }

  private fun response(conn: HttpURLConnection): String {
    val status = conn.responseCode
    val stream = if (status in 200..299) conn.inputStream else conn.errorStream
    val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
    if (status !in 200..299) {
      val message = runCatching { JSONObject(text).optString("error") }.getOrDefault("")
      throw SyncFailure(
        if (message.isNotBlank()) message else "HTTP $status",
        status == 429 || status >= 500, status,
      )
    }
    return text
  }

  private fun request(
    c: Context,
    route: String,
    body: JSONObject? = null,
    method: String = if (body == null) "GET" else "POST",
  ): JSONObject {
    val conn = connection(c, route, method)
    try {
      if (body != null) {
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        val bytes = body.toString().toByteArray(Charsets.UTF_8)
        conn.setFixedLengthStreamingMode(bytes.size)
        conn.outputStream.use { it.write(bytes) }
      }
      return JSONObject(response(conn))
    } finally {
      conn.disconnect()
    }
  }

  private fun upload(c: Context, file: JSONObject): JSONObject {
    val path = File(file.getString("path")).canonicalFile
    require(path.parentFile == File(c.filesDir, "documents").canonicalFile)
    if (!path.isFile || path.length() > 8 * 1024 * 1024)
      throw SyncFailure("Local file is missing or exceeds 8 MiB", false)
    val boundary = "sg" + UUID.randomUUID().toString().replace("-", "")
    val parts =
      MultipartBody.parts(
        file.getString("id"),
        file.getString("name"),
        file.getString("mime"),
        file.optBoolean("profile"),
        boundary,
      )
    val prefix = parts.prefix
    val suffix = parts.suffix
    val conn = connection(c, "files", "POST")
    conn.doOutput = true
    conn.setFixedLengthStreamingMode(prefix.size.toLong() + path.length() + suffix.size)
    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
    try {
      conn.outputStream.buffered().use { out ->
        out.write(prefix)
        path.inputStream().use { it.copyTo(out, 65536) }
        out.write(suffix)
      }
      return JSONObject(response(conn))
    } finally {
      conn.disconnect()
    }
  }

  private fun without(array: JSONArray, predicate: (JSONObject) -> Boolean): JSONArray {
    val out = JSONArray()
    for (i in 0 until array.length()) {
      val o = array.getJSONObject(i)
      if (!predicate(o)) out.put(o)
    }
    return out
  }

  private fun save(c: Context, change: (JSONObject) -> Unit) {
    LocalDatabase(c).use { db ->
      db.update { r ->
        checkOwner(r)
        change(r)
        r
      }
    }
  }

  fun run(c: Context, force: Boolean = false, stopped: () -> Boolean = { false }): JSONObject =
    lock.withLock {
      if (SecureVault(c).get().isEmpty()) throw SyncFailure("Sign in to synchronize", false)
      identity.set(identityOf(root(c)))
      val start = android.os.SystemClock.elapsedRealtime()
      fun checkpoint() {
        checkOwner(root(c))
        if (SecureVault(c).get().isEmpty()) throw SyncFailure("Sign in to synchronize", false)
        if (stopped() || android.os.SystemClock.elapsedRealtime() - start > 8 * 60 * 1000)
          throw SyncFailure("Synchronization paused; queued changes are safe")
      }
      try {
        val before = SecureVault(c).get()
        val refreshed = request(c, "auth/refresh", JSONObject())
        if (!SecureVault(c).rotate(before, refreshed.getString("token")))
          throw SyncFailure("Session changed; retry synchronization", false)
        val deletions = root(c).optJSONArray("pendingFileDeletes") ?: JSONArray()
        for (i in 0 until deletions.length()) {
          checkpoint()
          val id = deletions.getString(i)
          try {
            request(c, "files/$id", null, "DELETE")
          } catch (e: SyncFailure) {
            if (e.message != "File not found") throw e
          }
          save(c) { r ->
            val list = r.optJSONArray("pendingFileDeletes") ?: JSONArray()
            r.put(
              "pendingFileDeletes",
              JSONArray((0 until list.length()).map { list.getString(it) }.filter { it != id }),
            )
          }
        }
        // Push worship records before optional document bytes, so upload failures cannot block
        // history.
        val initial = root(c).optJSONArray("queue") ?: JSONArray()
        for (i in 0 until initial.length()) {
          checkpoint()
          // A foreground edit may have superseded an operation or an earlier ACK rebased it.
          val op = SyncQueue.candidate(root(c),initial.getJSONObject(i).getString("id")) ?: continue
          if (op.getJSONObject("record").getJSONObject("data").has("_cloud")) continue
          if (!force && op.optLong("nextTry") > System.currentTimeMillis()) continue
          try {
            val result =
              request(
                  c,
                  "sync/push",
                  JSONObject()
                    .put(
                      "operations",
                      JSONArray()
                        .put(
                          JSONObject()
                            .put("operationId", op.getString("id"))
                            .put("record", op.getJSONObject("record"))
                        ),
                    ),
                )
                .getJSONArray("results")
                .getJSONObject(0)
            save(c) { r ->
              val queue = r.optJSONArray("queue") ?: JSONArray()
              val sent = op.getJSONObject("record")
              if (result.optBoolean("conflict")) {
                for (j in 0 until queue.length()) {
                  val q = queue.getJSONObject(j)
                  if (q.getString("id") == op.getString("id")) {
                    q.put("error", "Conflict: review local and cloud values in Sync Center")
                      .put("attempts", q.optInt("attempts") + 1)
                      .put("nextTry", Long.MAX_VALUE)
                    q.getJSONObject("record")
                      .getJSONObject("data")
                      .put("_cloud", result.get("record"))
                  }
                }
              } else {
                val version = result.getInt("version")
                r.put("queue", without(queue) { it.getString("id") == op.getString("id") })
                NativeRecords.record(r, sent.getString("entity"), sent.getString("id"))
                  ?.put("version", version)
                val remaining = r.getJSONArray("queue")
                for (j in 0 until remaining.length()) {
                  val q = remaining.getJSONObject(j).getJSONObject("record")
                  if (
                    q.getString("entity") == sent.getString("entity") &&
                      q.getString("id") == sent.getString("id")
                  )
                    q.put("version", version)
                }
              }
            }
          } catch (e: Exception) {
            save(c) { r ->
              val queue = r.optJSONArray("queue") ?: JSONArray()
              for (j in 0 until queue.length()) {
                val q = queue.getJSONObject(j)
                if (q.getString("id") == op.getString("id")) {
                  val attempts = q.optInt("attempts") + 1
                  q.put("attempts", attempts)
                    .put(
                      "nextTry",
                      System.currentTimeMillis() + minOf(3600000L, 1000L shl minOf(attempts, 12)),
                    )
                    .put("error", e.message)
                }
              }
            }
            throw e
          }
        }
        val local = root(c).optJSONArray("localFiles") ?: JSONArray()
        for (i in 0 until local.length()) {
          checkpoint()
          val f = local.getJSONObject(i)
          if (
            f.optString("cloudId").isNotEmpty() ||
              (!force && f.optLong("nextTry") > System.currentTimeMillis())
          )
            continue
          try {
            val remote = upload(c, f)
            save(c) { r ->
              val files = r.optJSONArray("localFiles") ?: JSONArray()
              for (j in 0 until files.length()) {
                val current = files.getJSONObject(j)
                if (current.getString("id") == f.getString("id")) {
                  current.put("cloudId", remote.getString("id"))
                  current.remove("error")
                  current.remove("nextTry")
                }
              }
              val records = r.optJSONArray("records") ?: JSONArray()
              for (j in 0 until records.length()) {
                val record = records.getJSONObject(j)
                val data = record.getJSONObject("data")
                if (
                  record.getString("entity") == "routines" &&
                    !record.optBoolean("deleted") &&
                    data.optString("fileId") == f.getString("id") &&
                    data.optString("fileCloudId") != remote.getString("id")
                ) {
                  data.put("fileCloudId", remote.getString("id"))
                  NativeRecords.put(r, "routines", record.getString("id"), data)
                }
              }
            }
          } catch (e: Exception) {
            save(c) { r ->
              val files = r.optJSONArray("localFiles") ?: JSONArray()
              for (j in 0 until files.length()) {
                val current = files.getJSONObject(j)
                if (current.getString("id") == f.getString("id")) {
                  val attempts = current.optInt("attempts") + 1
                  current
                    .put("error", e.message)
                    .put("attempts", attempts)
                    .put(
                      "nextTry",
                      System.currentTimeMillis() + minOf(3600000L, 1000L shl minOf(attempts, 12)),
                    )
                }
              }
            }
          }
        }
        var more = true
        while (more) {
          checkpoint()
          val page = request(c, "sync/pull/" + root(c).optLong("cursor"))
          save(c) { r ->
            val changes = page.getJSONArray("records")
            val queue = r.optJSONArray("queue") ?: JSONArray()
            val records = r.optJSONArray("records") ?: JSONArray()
            for (i in 0 until changes.length()) {
              val change = changes.getJSONObject(i)
              val pending =
                (0 until queue.length()).any { j ->
                  val q = queue.getJSONObject(j).getJSONObject("record")
                  q.getString("entity") == change.getString("entity") &&
                    q.getString("id") == change.getString("id")
                }
              if (pending) continue
              var index = -1
              for (j in 0 until records.length()) {
                val old = records.getJSONObject(j)
                if (
                  old.getString("entity") == change.getString("entity") &&
                    old.getString("id") == change.getString("id")
                ) {
                  index = j
                  break
                }
              }
              if (index < 0) records.put(change) else records.put(index, change)
            }
            r.put("records", records).put("cursor", page.getLong("cursor"))
          }
          more = page.getBoolean("more")
        }
        val cloud = request(c, "sync/status")
        val profile = request(c, "profile")
        save(c) { r ->
          r.put("cloud", cloud)
            .put("profile", profile)
            .put("nativeSyncCheckedAt", Instant.now().toString())
          r.remove("nativeSyncError")
          val prefs = NativeRecords.record(r, "user_settings", "preferences")
          val queue = r.optJSONArray("queue") ?: JSONArray()
          if (
            prefs != null &&
              !prefs.optBoolean("deleted") &&
              !(0 until queue.length()).any {
                val q = queue.getJSONObject(it).getJSONObject("record")
                q.optString("entity") == "user_settings" && q.optString("id") == "preferences"
              }
          ) {
            val address = r.getJSONObject("settings").optString("api")
            val settings = JSONObject(r.getJSONObject("settings").toString())
            val cloudSettings = prefs.getJSONObject("data")
            cloudSettings.keys().forEach { key -> if(key !in listOf("api","soundUris","soundNames","privateActivityReminders","privateCheckinDoneDay","privatePenaltyReminders"))settings.put(key, cloudSettings.get(key)) }
            settings.put("api", address)
            r.put("settings", settings)
          }
          val files = r.optJSONArray("localFiles") ?: JSONArray()
          val complete =
            queue.length() == 0 &&
              (r.optJSONArray("pendingFileDeletes")?.length() ?: 0) == 0 &&
              (0 until files.length()).all {
                files.getJSONObject(it).optString("cloudId").isNotEmpty()
              }
          r.put("nativeSyncPending", !complete)
          if (complete) r.put("lastSync", Instant.now().toString())
        }
        syncGemEconomy(c)
        runCatching { ReminderScheduler.rebuild(c) }
        root(c)
      } catch (e: Exception) {
        save(c) { it.put("nativeSyncError", e.message ?: "Synchronization failed") }
        throw e
      } finally {
        identity.remove()
      }
    }
}

object BackgroundSync {
  fun enqueue(c: Context) {
    if (SecureVault(c).get().isEmpty()) return
    val raw = LocalDatabase(c).use { it.load() }
    if (
      raw.isEmpty() || JSONObject(raw).optJSONObject("settings")?.optString("api").isNullOrEmpty()
    )
      return
    val state = JSONObject(raw)
    val files = state.optJSONArray("localFiles") ?: JSONArray()
    if (
      (state.optJSONArray("queue")?.length() ?: 0) == 0 &&
        (state.optJSONArray("pendingFileDeletes")?.length() ?: 0) == 0 &&
        (0 until files.length()).all { files.getJSONObject(it).optString("cloudId").isNotEmpty() }
    )
      return
    val request =
      OneTimeWorkRequestBuilder<SyncWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()
    WorkManager.getInstance(c)
      .enqueueUniqueWork("salahguard.sync", ExistingWorkPolicy.KEEP, request)
  }

  fun periodic(c: Context) {
    WorkManager.getInstance(c)
      .enqueueUniquePeriodicWork(
        "salahguard.sync.periodic",
        ExistingPeriodicWorkPolicy.UPDATE,
        PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
          .setConstraints(
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
          )
          .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
          .build(),
      )
  }
}

class SyncWorker(c: Context, p: WorkerParameters) : Worker(c, p) {
  override fun doWork(): Result =
    try {
      if (SecureVault(applicationContext).get().isEmpty()) Result.success()
      else {
        val r = SyncEngine.run(applicationContext, false) { isStopped }
        if (r.optBoolean("nativeSyncPending")) Result.retry() else Result.success()
      }
    } catch (e: SyncFailure) {
      if (e.retryable) Result.retry() else Result.failure()
    } catch (_: Exception) {
      Result.retry()
    } finally {
      NativeSignals.changed(applicationContext)
    }
}
