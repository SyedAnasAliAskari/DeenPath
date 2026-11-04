package org.salahguard.app
import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.json.JSONObject
import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
@RunWith(AndroidJUnit4::class)
class StoryNarratorTest {
 @Test fun deviceEnginePlaybackAndLanguageFallback(){
  val instrumentation=InstrumentationRegistry.getInstrumentation();val events=LinkedBlockingQueue<JSONObject>();var reader:StoryNarrator?=null
  val report=JSONObject();val scenario=ActivityScenario.launch<MainActivity>(Intent(instrumentation.targetContext,MainActivity::class.java))
  try{
   scenario.onActivity{activity->reader=StoryNarrator(activity){event->events.offer(JSONObject(event.toString()))};reader!!.command("play","synthetic-check","en","This is a DeenPath narration check. ".repeat(8))}
   fun terminal(language:String):JSONObject{val end=System.currentTimeMillis()+20000;var last=JSONObject();while(System.currentTimeMillis()<end){val event=events.poll(1,TimeUnit.SECONDS)?:continue;if(event.optString("language")!=language)continue;last=event;if(event.optString("state") in listOf("missing","error")||event.optBoolean("engineStarted"))return event};return last}
   val english=terminal("en");report.put("english",english);assertTrue(english.optString("state") in listOf("playing","missing","error"))
   scenario.onActivity{val paused=reader!!.command("pause");if(english.optString("state")=="playing")assertEquals("paused",paused.getString("state"));reader!!.command("play","synthetic-check","en","This is a DeenPath narration check. ".repeat(8),.75f);reader!!.command("stop");assertEquals("stopped",reader!!.command("status").getString("state"));reader!!.command("play","synthetic-check","ur","یہ صرف آواز کی جانچ ہے۔ اس میں کوئی تاریخی یا مذہبی دعویٰ نہیں ہے۔")}
   val urdu=terminal("ur");report.put("urdu",urdu);assertTrue(urdu.optString("state") in listOf("playing","missing","error"))
   scenario.onActivity{reader!!.command("stop");assertEquals("stopped",reader!!.command("status").getString("state"));reader!!.release()}
   // No installation intent is launched by this test. It remains an explicit reader action.
  }finally{scenario.onActivity{reader?.release()};scenario.close();File(instrumentation.targetContext.cacheDir,"qa-narration.json").writeText(report.toString())}
 }
}
