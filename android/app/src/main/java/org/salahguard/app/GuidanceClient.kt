package org.salahguard.app

import android.content.Context
import java.net.HttpURLConnection
import java.net.URI
import org.json.JSONArray
import org.json.JSONObject

/**
 * Only documented Gemini REST hosts and user-owned device-local keys are supported. No proxy or
 * master key.
 */
object GuidanceClient {
  private val lastCall = java.util.concurrent.ConcurrentHashMap<String, Long>()

  private fun store(c: Context): SecureVault {
    val owner = LocalDatabase(c).use { SnapshotDocument.owner(it.load()) }
    return SecureVault(c, "deen.providers.$owner")
  }

  fun settings(c: Context): JSONObject =
    store(c).get().let { if (it.isEmpty()) JSONObject() else JSONObject(it) }

  fun configure(c: Context, which: String, key: String, model: String) {
    require(key.length <= 300 && !key.contains('\n') && !key.contains('\r'))
    require(which in listOf("paid", "gemini"))
    require(model.matches(Regex("[a-zA-Z0-9._-]{1,100}")))
    val s = settings(c)
    s.put(which, JSONObject().put("key", key).put("model", model))
    store(c).set(s.toString())
  }

  fun status(c: Context): JSONObject {
    val s = settings(c)
    return JSONObject()
      .put("paid", !s.optJSONObject("paid")?.optString("key").isNullOrEmpty())
      .put("gemini", !s.optJSONObject("gemini")?.optString("key").isNullOrEmpty())
  }

  fun request(
    c: Context,
    which: String,
    messages: JSONArray,
    modelOverride: String = "",
  ): JSONObject {
    val rateKey = which + LocalDatabase(c).use { SnapshotDocument.owner(it.load()) }
    synchronized(lastCall) {
      val now = android.os.SystemClock.elapsedRealtime()
      require(now - (lastCall[rateKey] ?: -30000L) >= 10000L) {
        "Wait ten seconds before another provider request"
      }
      lastCall[rateKey] = now
    }
    val s =
      settings(c).optJSONObject(which) ?: throw IllegalArgumentException("Provider not configured")
    val key = s.optString("key")
    require(key.isNotBlank()) { "Provider not configured" }
    val model = if (modelOverride.isBlank()) s.getString("model") else modelOverride
    require(model.matches(Regex("[a-zA-Z0-9._-]{1,100}")))
    val contents = JSONArray()
    for (i in maxOf(0, messages.length() - 20) until messages.length()) {
      val m = messages.getJSONObject(i)
      val text = m.getString("text")
      require(text.length <= 12000)
      contents.put(
        JSONObject()
          .put("role", if (m.optString("role") == "assistant") "model" else "user")
          .put("parts", JSONArray().put(JSONObject().put("text", text)))
      )
    }
    val body =
      JSONObject()
        .put("contents", contents)
        .put(
          "systemInstruction",
          JSONObject()
            .put(
              "parts",
              JSONArray()
                .put(
                  JSONObject()
                    .put(
                      "text",
                      "You are DeenPath Guidance, an educational assistant, not a Mufti. Respond in the user's language including Roman Urdu. Acknowledge uncertainty and scholarly differences. Never invent scripture, hadith, citations, or claim a fatwa. Avoid verbatim quotations unless supplied from a verified resource. Clearly label any references as unverified. Refer important personal religious rulings to a qualified scholar. Do not claim to know private app records.",
                    )
                ),
            ),
        )
        .put("generationConfig", JSONObject().put("maxOutputTokens", 1500))
    val connection =
      URI("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent")
        .toURL()
        .openConnection() as HttpURLConnection
    connection.connectTimeout = 15000
    connection.readTimeout = 45000
    connection.instanceFollowRedirects = false
    connection.requestMethod = "POST"
    connection.doOutput = true
    connection.setRequestProperty("Content-Type", "application/json")
    connection.setRequestProperty("x-goog-api-key", key)
    return try {
      val bytes = body.toString().toByteArray(Charsets.UTF_8)
      connection.setFixedLengthStreamingMode(bytes.size)
      connection.outputStream.use { it.write(bytes) }
      val code = connection.responseCode
      if (code !in 200..299) JSONObject().put("ok", false).put("status", code)
      else {
        val raw = connection.inputStream.bufferedReader().use { it.readText() }
        require(raw.length < 500000)
        val parts =
          JSONObject(raw)
            .optJSONArray("candidates")
            ?.optJSONObject(0)
            ?.optJSONObject("content")
            ?.optJSONArray("parts")
        val text = buildString {
          if (parts != null)
            for (i in 0 until parts.length()) if (!parts.getJSONObject(i).optBoolean("thought"))
              append(parts.getJSONObject(i).optString("text"))
        }
        JSONObject()
          .put("ok", text.isNotBlank())
          .put("text", text)
          .put("status", if (text.isBlank()) 422 else 200)
      }
    } finally {
      connection.disconnect()
    }
  }
}
