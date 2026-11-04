package org.salahguard.app
import android.content.Context
import android.graphics.*
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
object WidgetPresentation {
 fun views(c:Context,kind:String,model:JSONObject,dark:Boolean,height:Int,fontScale:Float,lang:String,signedOut:Boolean=false):RemoteViews {
  val highFont=fontScale>1.3f;val small=height<160||(highFont&&height<240);val large=height>=220
  val views=RemoteViews(c.packageName,if(large)R.layout.widget_large else R.layout.widget_card)
  val ink=Color.parseColor(if(dark)"#EEF3E7" else "#174936");val muted=Color.parseColor(if(dark)"#B7CABD" else "#526C5B")
  views.setInt(R.id.widget_root,"setLayoutDirection",if(lang=="en")View.LAYOUT_DIRECTION_LTR else View.LAYOUT_DIRECTION_RTL)
  views.setInt(R.id.widget_root,"setBackgroundResource",if(dark)R.drawable.widget_dark else R.drawable.widget_light)
  val padding=((if(small)8 else 16)*c.resources.displayMetrics.density).toInt();views.setViewPadding(R.id.widget_root,padding,padding,padding,padding)
  for(id in listOf(R.id.widget_title,R.id.widget_body,R.id.widget_timer))views.setTextColor(id,ink)
  for(id in listOf(R.id.widget_brand,R.id.widget_detail,R.id.widget_action))views.setTextColor(id,muted)
  fun visible(id:Int,show:Boolean)=views.setViewVisibility(id,if(show)View.VISIBLE else View.GONE)
  visible(R.id.widget_header,!(small&&highFont));visible(R.id.widget_detail,height>=190&&!highFont);visible(R.id.widget_action,large&&!highFont&&(kind!="garden"||height>=300))
  val icon=when(kind){"gems"->R.drawable.widget_icon_gems;"garden","collection"->R.drawable.widget_icon_collection;"daily"->R.drawable.widget_icon_daily;else->R.drawable.widget_icon_prayer};views.setImageViewResource(R.id.widget_icon,icon)
  visible(R.id.widget_config,false)
  views.setTextViewText(R.id.widget_brand,if(kind=="prayer"&&small)EnforcerUi.text(c,"PRAYER · TIME LEFT","نماز · باقی وقت","الصلاة · الوقت المتبقي")else "DEENPATH")
  views.setTextViewText(R.id.widget_title,model.optString("title"));views.setTextViewText(R.id.widget_body,model.optString("body"));views.setTextViewText(R.id.widget_detail,model.optString("detail"))
  if(small&&kind=="daily"){
   views.setTextViewText(R.id.widget_title,EnforcerUi.text(c,"Today","آج","اليوم"))
   views.setTextViewText(R.id.widget_body,"${model.optInt("done")}/${model.optInt("total")} "+EnforcerUi.text(c,"Prayers","نمازیں","الصلوات")+"\n${model.optInt("routineDone")}/${model.optInt("routineTotal")} "+EnforcerUi.text(c,"Routines","معمولات","الأوراد"))
  }
  views.setTextViewTextSize(R.id.widget_title,TypedValue.COMPLEX_UNIT_SP,if(small&&highFont)14f else if(small)17f else if(highFont)18f else if(large)25f else 22f)
  views.setTextViewTextSize(R.id.widget_body,TypedValue.COMPLEX_UNIT_SP,if(small&&highFont&&kind=="daily")8f else if(small&&highFont)10f else if(small)12f else if(highFont)12f else 14f)
  views.setTextViewTextSize(R.id.widget_timer,TypedValue.COMPLEX_UNIT_SP,if(small)25f else if(highFont)26f else if(large)36f else 30f)
  views.setTextViewText(R.id.widget_action,when(kind){"gems"->EnforcerUi.text(c,"Open Gems ›","جواہرات کھولیں ›","افتح الجواهر ›");"garden","collection"->EnforcerUi.text(c,"Open your collection ›","اپنا مجموعہ کھولیں ›","افتح مجموعتك ›");"daily"->EnforcerUi.text(c,"Continue your day ›","اپنا دن جاری رکھیں ›","تابع يومك ›");else->EnforcerUi.text(c,"Open DeenPath ›","دین پاتھ کھولیں ›","افتح دين باث ›")})
  val at=model.optLong("target");val timer=kind=="prayer"&&at>System.currentTimeMillis();visible(R.id.widget_timer,timer);visible(R.id.widget_body,!(small&&timer))
  if(timer){views.setChronometer(R.id.widget_timer,SystemClock.elapsedRealtime()+at-System.currentTimeMillis(),null,true);views.setChronometerCountDown(R.id.widget_timer,true)}
  visible(R.id.widget_progress,!signedOut&&!(small&&highFont));visible(R.id.widget_routine_progress,kind=="daily"&&!signedOut&&!(small&&highFont))
  views.setProgressBar(R.id.widget_progress,maxOf(1,model.optInt("total",5)),model.optInt("done"),false)
  views.setProgressBar(R.id.widget_routine_progress,maxOf(1,model.optInt("routineTotal")),model.optInt("routineDone"),false)
  views.setContentDescription(R.id.widget_progress,"${model.optInt("done")} / ${model.optInt("total")}");views.setContentDescription(R.id.widget_routine_progress,"${model.optInt("routineDone")} / ${model.optInt("routineTotal")}")
  visible(R.id.widget_art,false)
  views.setContentDescription(R.id.widget_root,listOf("DeenPath",model.optString("title"),model.optString("body"),model.optString("detail")).filter{it.isNotEmpty()}.joinToString(". "))
  return views
 }
}
