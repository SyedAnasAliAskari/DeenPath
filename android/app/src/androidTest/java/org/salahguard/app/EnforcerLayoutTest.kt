package org.salahguard.app
import android.content.res.Configuration
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ScrollView
import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class EnforcerLayoutTest {
 @Test fun laterActionStaysAboveNavigationAtLargeText(){val instrumentation=InstrumentationRegistry.getInstrumentation();val target=instrumentation.targetContext;instrumentation.runOnMainSync{
  for(font in listOf(1f,2f)){
   val config=Configuration(target.resources.configuration);config.fontScale=font;val c=ContextThemeWrapper(target.createConfigurationContext(config),R.style.AppTheme_NoActionBar);val density=c.resources.displayMetrics.density;val width=(320*density).toInt();val height=(640*density).toInt()
   val event=JSONObject().put("route","test").put("title","DeenPath layout check").put("body","Synthetic layout text. ".repeat(30)).put("windowStart",java.time.Instant.now().minusSeconds(60).toString()).put("windowEnd",java.time.Instant.now().plusSeconds(600).toString())
   val root=EnforcerUi.create(c,event){error("Layout inspection must not record an action")} as ViewGroup;root.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(height,View.MeasureSpec.EXACTLY));root.layout(0,0,width,height)
   fun descendants(view:View):List<View> = listOf(view)+if(view is ViewGroup)(0 until view.childCount).flatMap{descendants(view.getChildAt(it))}else emptyList()
   val scroll=descendants(root).filterIsInstance<ScrollView>().single();assertEquals("Action footer should not require scrolling",0,scroll.scrollY)
   val later=descendants(root).filterIsInstance<Button>().single{it.text.toString()==NativeUi.text(c,"later")};val rect=Rect();later.getDrawingRect(rect);root.offsetDescendantRectToMyCoords(later,rect);assertTrue("Bottom action overlaps safe area at font $font: $rect",rect.bottom<=height-root.paddingBottom);assertTrue(root.paddingBottom>=40*density-1);assertTrue(later.height>=48*density)
  }
 }}
}
