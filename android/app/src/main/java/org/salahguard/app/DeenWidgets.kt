package org.salahguard.app

import android.app.*
import android.appwidget.*
import android.content.*
import android.os.*
import android.view.View
import android.widget.RemoteViews
import androidx.work.*
import org.json.JSONObject
import java.time.Instant

open class DeenWidgetProvider:AppWidgetProvider() {
 override fun onUpdate(c:Context,m:AppWidgetManager,ids:IntArray) { WidgetUpdates.request(c) }
 override fun onAppWidgetOptionsChanged(c:Context,m:AppWidgetManager,id:Int,options:Bundle) { WidgetUpdates.request(c) }
 override fun onEnabled(c:Context) { WidgetUpdates.request(c) }
 override fun onRestored(c:Context,oldIds:IntArray,newIds:IntArray) {
  val prefs=c.getSharedPreferences("widgets",0)
  val saved=oldIds.map { prefs.getString("selection:$it",null) }
  val edit=prefs.edit()
  oldIds.indices.filter { it<newIds.size }.forEach { index -> saved[index]?.takeIf { it in WidgetModel.selections }?.let { edit.putString("selection:${newIds[index]}",it) } }
  edit.apply()
  WidgetUpdates.request(c)
 }
 override fun onDeleted(c:Context,ids:IntArray) { val edit=c.getSharedPreferences("widgets",0).edit();ids.forEach { edit.remove("selection:$it") };edit.apply();WidgetUpdates.request(c) }
 override fun onReceive(c:Context,i:Intent) { super.onReceive(c,i); if(i.action=="org.salahguard.app.WIDGET_REFRESH") WidgetUpdates.request(c) }
}
class PrayerWidget:DeenWidgetProvider()
class StreakWidget:DeenWidgetProvider()
class GardenWidget:DeenWidgetProvider()
class DailyWidget:DeenWidgetProvider()

object WidgetUpdates {
 private val kinds=mapOf(PrayerWidget::class.java to "prayer",StreakWidget::class.java to "gems",GardenWidget::class.java to "collection",DailyWidget::class.java to "daily")
 fun request(c:Context) { runCatching { WorkManager.getInstance(c).enqueueUniqueWork("deen.widgets",ExistingWorkPolicy.REPLACE,OneTimeWorkRequestBuilder<WidgetWorker>().build()) } }
 fun update(c:Context) = synchronized(LocalDatabase.snapshotLock) {
  val manager=AppWidgetManager.getInstance(c)
  val root=LocalDatabase(c).use { runCatching { JSONObject(it.load()) }.getOrDefault(JSONObject()) }
  val signedOut=root.optString("owner").let { it.isNotEmpty() && it!="null" } && SecureVault(c).get().isEmpty()
  var target:Long?=null
  for((clazz,kind) in kinds) for(id in manager.getAppWidgetIds(ComponentName(c,clazz))) {
   val selection=c.getSharedPreferences("widgets",0).getString("selection:$id","Overall") ?: "Overall"
   val model=if(signedOut) JSONObject().put("title","DeenPath").put("body",EnforcerUi.text(c,"Sign in to view your progress","پیش رفت کے لیے لاگ ان کریں","سجل الدخول لعرض تقدمك")) else runCatching { WidgetModel.projection(root,kind,selection) }.getOrElse { JSONObject().put("title","Open DeenPath").put("body","Check your location and prayer settings") }
   val settings=root.optJSONObject("settings") ?: JSONObject()
   val dark=settings.optString("appearance")=="dark" || (settings.optString("appearance","system")=="system" && (c.resources.configuration.uiMode and 48)==32)
   val options=manager.getAppWidgetOptions(id)
   val height=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,160)
   val views=WidgetPresentation.views(c,kind,model,dark,height,c.resources.configuration.fontScale,settings.optString("lang","en"),signedOut)
   val at=model.optLong("target",0)
   if(at>System.currentTimeMillis()) target=if(target==null)at else minOf(target,at)
   val intent=Intent(c,MainActivity::class.java).putExtra("reminder","widget:$kind").setData(android.net.Uri.parse("salahguard://widget/$kind/$id"))
   views.setOnClickPendingIntent(R.id.widget_root,PendingIntent.getActivity(c,id,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
   if(kind=="streak") views.setOnClickPendingIntent(R.id.widget_title,PendingIntent.getActivity(c,id,Intent(c,WidgetConfigActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
   if(kind=="streak") views.setOnClickPendingIntent(R.id.widget_action,PendingIntent.getActivity(c,id,Intent(c,WidgetConfigActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
   manager.updateAppWidget(id,views)
  }
  val all=kinds.keys.sumOf { manager.getAppWidgetIds(ComponentName(c,it)).size }
  val alarm=c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  val pending=PendingIntent.getBroadcast(c,2533,Intent(c,PrayerWidget::class.java).setAction("org.salahguard.app.WIDGET_REFRESH"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  alarm.cancel(pending)
  if(all>0) {
   val at=minOf(target ?: Long.MAX_VALUE,System.currentTimeMillis()+1800000L)+1000
   try {
    if(Build.VERSION.SDK_INT<31 || alarm.canScheduleExactAlarms()) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending)
    else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending)
   } catch(_:SecurityException) { alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending) }
  }
 }
}
class WidgetWorker(c:Context,p:WorkerParameters):Worker(c,p) {
 override fun doWork():Result = try { WidgetUpdates.update(applicationContext);Result.success() } catch(error:Exception) { android.util.Log.w("DeenPath","Widget refresh deferred",error);Result.retry() }
}
class WidgetConfigActivity:Activity() {
 override fun onCreate(state:Bundle?) {
  super.onCreate(state)
  val id=intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID)
  setResult(RESULT_CANCELED)
  if(id==AppWidgetManager.INVALID_APPWIDGET_ID) { finish();return }
  val provider=AppWidgetManager.getInstance(this).getAppWidgetInfo(id)?.provider
  // Some launchers configure an allocated ID before completing provider binding.
  if(provider!=null && provider.packageName!=packageName) { finish();return }
  WidgetUpdates.request(this)
  setResult(RESULT_OK,Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id))
  startActivity(Intent(this,MainActivity::class.java).putExtra("reminder","widget:gems"));finish()

 }
}
