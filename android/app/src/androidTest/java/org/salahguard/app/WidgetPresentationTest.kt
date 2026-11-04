package org.salahguard.app
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.Locale
@RunWith(AndroidJUnit4::class)
class WidgetPresentationTest {
 @Test fun cancelSyntheticReminders(){ReminderScheduler.cancelTests(InstrumentationRegistry.getInstrumentation().targetContext)}
 @Test fun snapshotForUpgradeIntegrityCheck(){
  val app=InstrumentationRegistry.getInstrumentation().targetContext
  val value=LocalDatabase(app).use{it.load()};assertTrue(JSONObject(value).has("records"))
  File(app.cacheDir,"qa-after-upgrade.json").writeText(value)
 }

 @Test fun compactLargeRtlAndLargeTextRemainInsideTheirBounds(){
  val instrumentation=InstrumentationRegistry.getInstrumentation();val target=instrumentation.targetContext
  instrumentation.runOnMainSync{
   for(kind in listOf("prayer","gems","collection","daily"))for(size in listOf(110 to 110,180 to 180,320 to 260))for(font in listOf(1f,2f))for(dark in listOf(false,true))for(rtl in listOf(false,true)){
    val config=Configuration(target.resources.configuration);config.fontScale=font;config.uiMode=if(dark)Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO;config.setLocale(Locale(if(rtl)"ur" else "en"));config.setLayoutDirection(Locale(if(rtl)"ur" else "en"))
    val c=ContextThemeWrapper(target.createConfigurationContext(config),R.style.AppTheme_NoActionBar);val density=c.resources.displayMetrics.density
    val model=JSONObject().put("title",when(kind){"prayer"->"Fajr";"collection"->"My Collection";"gems"->"Gems";else->"Today's progress"}).put("body",when(kind){"prayer"->"Ends 6:00 AM";"gems"->"125 Gems";"collection"->"3 unique cards";else->"Prayers 3 / 5\nRoutines 2 / 4"}).put("detail","3 of 5 prayers recorded").put("done",3).put("total",5).put("routineDone",2).put("routineTotal",4).put("stages",JSONArray("[0,2,4]"))
    if(kind=="prayer")model.put("target",System.currentTimeMillis()+600000)
    val host=FrameLayout(c);val root=WidgetPresentation.views(c,kind,model,dark,size.second,font,if(rtl)"ur" else "en").apply(c,host) as ViewGroup
    val width=(size.first*density).toInt();val height=(size.second*density).toInt();root.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));root.layout(0,0,width,height)
    for(i in 0 until root.childCount){val child=root.getChildAt(i);if(child.visibility==View.GONE)continue;val rect=Rect();child.getDrawingRect(rect);root.offsetDescendantRectToMyCoords(child,rect);assertTrue("$kind $size font=$font dark=$dark rtl=$rtl view=${c.resources.getResourceEntryName(child.id)} bounds=$rect height=$height",rect.top>=0&&rect.bottom<=height)}
    if(size.first==320&&font==1f&&!rtl||size.first==110&&font==2f&&dark&&!rtl){val output=File(target.cacheDir,"widget-qa");output.mkdirs();val image=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);root.draw(Canvas(image));File(output,"$kind-${size.first}-${if(dark)"dark" else "light"}-font$font.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)};image.recycle()}
   }
  }
 }
}
