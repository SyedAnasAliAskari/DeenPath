package org.salahguard.app
import android.content.Intent
import android.content.ComponentName
import android.content.pm.ServiceInfo
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.lifecycle.Lifecycle
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
@RunWith(AndroidJUnit4::class)
class NotificationActionTest {
 @Test fun notificationActionsAreBroadcastsAndSnoozeClosesTheEnforcer(){
  val app=InstrumentationRegistry.getInstrumentation().targetContext
  val event=JSONObject().put("id","test:actions:"+UUID.randomUUID()).put("route","test").put("title","Synthetic action check").put("body","No prayer is recorded by this test.").put("category","gentle").put("at",System.currentTimeMillis()).put("windowStart",java.time.Instant.now().minusSeconds(60).toString()).put("windowEnd",java.time.Instant.now().plusSeconds(600).toString())
  val recordBefore=LocalDatabase(app).use{JSONObject(it.load()).getJSONArray("records").toString()}
  assertTrue(PrayerActions.activate(app,event))
  val prayed=ReminderPendingIntents.action(app,event,PrayerAction.PRAYED);val snooze=ReminderPendingIntents.action(app,event,PrayerAction.SNOOZE)
  try{
   assertFalse(prayed.isActivity);assertFalse(snooze.isActivity)
   if(android.os.Build.VERSION.SDK_INT>=31){assertTrue(prayed.isBroadcast);assertTrue(snooze.isBroadcast);assertTrue(prayed.isImmutable)}
   assertNotEquals(prayed,snooze)
   val info=app.packageManager.getActivityInfo(ComponentName(app,LockEnforcerActivity::class.java),0);assertEquals(app.packageName+".enforcer",info.taskAffinity)
   val service=app.packageManager.getServiceInfo(ComponentName(app,TimedEnforcerService::class.java),0);assertEquals(0,service.flags and ServiceInfo.FLAG_STOP_WITH_TASK)
   val scenario=ActivityScenario.launch<LockEnforcerActivity>(Intent(app,LockEnforcerActivity::class.java).putExtra("payload",event.toString()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
   try{snooze.send();val deadline=System.currentTimeMillis()+6000;while(scenario.state!=Lifecycle.State.DESTROYED&&System.currentTimeMillis()<deadline)Thread.sleep(100);assertEquals(Lifecycle.State.DESTROYED,scenario.state)}finally{scenario.close()}
   assertEquals(recordBefore,LocalDatabase(app).use{JSONObject(it.load()).getJSONArray("records").toString()})
  }finally{prayed.cancel();snooze.cancel();ReminderScheduler.cancelTests(app)}
 }
}
