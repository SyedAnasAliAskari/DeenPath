package org.salahguard.app

import android.app.*
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.provider.Settings
import java.security.MessageDigest
import org.json.JSONObject

/** Android channel sounds are immutable: an explicit new selection gets a stable new channel ID. */
object NotificationAudio {
  fun settings(c: Context): JSONObject =
    LocalDatabase(c).use {
      runCatching { JSONObject(it.load()).getJSONObject("settings") }.getOrDefault(JSONObject())
    }

  fun selection(c: Context, category: String): String {
    val sounds = settings(c).optJSONObject("soundUris")
    return sounds?.optString(category)?.takeIf { it.isNotBlank() }
      ?: sounds?.optString("default")?.takeIf { it.isNotBlank() }
      ?: Settings.System.DEFAULT_NOTIFICATION_URI.toString()
  }

  fun key(category: String, silent: Boolean, vibration: Boolean, sound: String): String {
    val hash =
      MessageDigest.getInstance("SHA-256").digest(sound.toByteArray()).take(5).joinToString("") {
        "%02x".format(it)
      }
    return (if(category in listOf("gentle","warning","strict","missed","test"))"sg_reminder_v3" else "sg_v2")+"_${category}_${silent}_${vibration}_$hash"
  }

  fun id(c: Context, category: String, silent: Boolean, vibration: Boolean): String =
    key(category, silent, vibration, selection(c, category))

  fun ensure(c: Context, category: String, silent: Boolean, vibration: Boolean): String {
    val s = settings(c)
    val lang = s.optString("lang", "en")
    val names =
      when (lang) {
        "ur" ->
          mapOf(
            "gentle" to "نرم یاد دہانی",
            "warning" to "تنبیہ",
            "strict" to "آخری یاد دہانی",
            "missed" to "رہ گئی نماز",
            "qaza" to "قضا کی تکمیل",
            "routine" to "معمولات",
            "test" to "آزمائش",
          )
        "ar" ->
          mapOf(
            "gentle" to "تذكير لطيف",
            "warning" to "تنبيه",
            "strict" to "تذكير أخير",
            "missed" to "صلاة فائتة",
            "qaza" to "إتمام القضاء",
            "routine" to "الأوراد",
            "test" to "اختبار",
          )
        else ->
          mapOf(
            "gentle" to "Gentle",
            "warning" to "Warning",
            "strict" to "Strict",
            "missed" to "Missed",
            "qaza" to "Qaza completed",
            "routine" to "Routines",
            "test" to "Test",
          )
      }
    val id = id(c, category, silent, vibration)
    val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val alarm=category in listOf("gentle","warning","strict","missed","test")
    // New channel identity is required to move legacy alarm audio to notification audio.
    // Carry over the effective old sound/importance, including user-muted channels.
    val previous=if(alarm)manager.getNotificationChannel(id.replace("sg_reminder_v3_","sg_alarm_v1_"))
      ?:manager.getNotificationChannel(id.replace("sg_reminder_v3_","sg_v2_")) else null
    val importance=if(previous!=null&&(previous.importance==NotificationManager.IMPORTANCE_NONE||previous.hasUserSetImportance()))previous.importance else if(alarm)NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
    val channel =
      NotificationChannel(
        id,
        "DeenPath · " + (names[category] ?: category),
        importance,
      )
    val sound = selection(c, category)
    val uri = if (silent || sound == "silent") null else if(previous!=null)previous.sound else Uri.parse(sound)
    channel.setSound(
      uri,
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
    )
    channel.enableVibration(vibration)
    (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .createNotificationChannel(channel)
    return id
  }
}
