package org.salahguard.app
import android.content.Context
import org.json.JSONObject
import org.json.JSONArray
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
/** Disk commits finish before this coalesced scheduling/sync maintenance runs. */
object ReminderMaintenance {
 private val executor=Executors.newSingleThreadScheduledExecutor()
 private var future:ScheduledFuture<*>?=null
 private var replan=false
 fun planKey(root:JSONObject):String{
  val records=root.optJSONArray("records")?:JSONArray();val selected=JSONArray()
  for(i in 0 until records.length()){val row=records.getJSONObject(i);if(row.optString("entity") in listOf("routines","prayer_records","routine_completions"))selected.put(row)}
  return JSONArray().put(root.opt("owner")).put(root.optJSONObject("settings")).put(selected).toString()
 }
 @Synchronized fun request(c:Context,plan:Boolean=false){
  val app=c.applicationContext;replan=replan||plan;future?.cancel(false)
  future=executor.schedule({val rebuild=synchronized(this){val value=replan;replan=false;future=null;value}
   runCatching{if(rebuild){TimedEnforcerService.reconcile(app);OverlayReminderService.refresh(app);ReminderScheduler.suppressCompleted(app);ReminderScheduler.rebuild(app)};BackgroundSync.enqueue(app)}.onFailure{android.util.Log.e("DeenPath","Reminder maintenance deferred",it);ReminderDiagnostics.record(app,"reminder_maintenance_deferred")}
  },250,TimeUnit.MILLISECONDS)
 }
}
