package org.salahguard.app
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
object ReminderPendingIntents {
 fun action(c:Context,r:JSONObject,action:PrayerAction):PendingIntent=PendingIntent.getBroadcast(c,0,
  Intent(c,ReminderReceiver::class.java).setAction("org.salahguard.app.ACTION_"+action.name)
   .setData(Uri.parse("salahguard://action/"+Uri.encode(r.getString("id"))+"/"+action.name)).putExtra("payload",r.toString()),
  PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}
