package org.salahguard.app

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import java.time.*
import java.time.format.DateTimeFormatter
import org.json.JSONObject

/** Shared accessible content for the application overlay and secure lock-screen Activity. */
object EnforcerUi {
  fun text(c: Context, en: String, ur: String, ar: String): String = when(NotificationAudio.settings(c).optString("lang")) { "ur" -> ur; "ar" -> ar; else -> en }
  fun actionLabel(c: Context, action: PrayerAction) = when(action) {
    PrayerAction.PRAYED -> text(c, "I Prayed", "نماز ادا کر لی", "صليت")
    PrayerAction.QAZA -> text(c, "Complete Qaza", "قضا ادا کریں", "إكمال القضاء")
    PrayerAction.SNOOZE -> NativeUi.text(c, "later")
    PrayerAction.CLOSE -> text(c, "Close", "بند کریں", "إغلاق")
  }
  fun timing(c: Context, r: JSONObject): String {
    val s = NotificationAudio.settings(c)
    val end = runCatching { Instant.parse(r.getString("windowEnd")) }.getOrNull() ?: return ""
    val zone = runCatching { ZoneId.of(s.optString("timezone")) }.getOrDefault(ZoneId.systemDefault())
    val formatter = DateTimeFormatter.ofPattern("h:mm a").withZone(zone)
    val start = runCatching { formatter.format(Instant.parse(r.getString("windowStart"))) }.getOrDefault("—")
    return start + "  ·  " + text(c, "Ends", "اختتام", "ينتهي") + " " + formatter.format(end)
  }
  fun create(c: Context, r: JSONObject, action: (PrayerAction) -> Unit): View {
    if(r.optString("route")=="private" || r.optBoolean("testSecrets"))return SecretEnforcerUi.create(c,r,action)
    val s = NotificationAudio.settings(c)
    val dark = s.optString("appearance") == "dark" || (s.optString("appearance", "system") == "system" && (c.resources.configuration.uiMode and 48) == 32)
    val ink = if(dark) Color.rgb(237,244,232) else Color.rgb(20,65,50)
    val paper = if(dark) Color.rgb(19,42,34) else Color.rgb(253,250,240)
    fun dp(n: Int) = (n*c.resources.displayMetrics.density).toInt()
    val scroll = ScrollView(c).apply { isFillViewport = true; clipToPadding = false; background = GradientDrawable().apply { setColor(paper); cornerRadius = 0f }; elevation=0f }
    val content = LinearLayout(c).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(24), dp(24), dp(28))
      layoutDirection = if(s.optString("lang", "en") == "en") View.LAYOUT_DIRECTION_LTR else View.LAYOUT_DIRECTION_RTL
      background = GradientDrawable().apply { setColor(paper); cornerRadius = dp(28).toFloat() }
    }
    scroll.addView(content)
    fun label(value: String, size: Float, parent:LinearLayout = content): TextView = TextView(c).apply {
      text = value; textSize = size; setTextColor(ink); setPadding(0, dp(6), 0, dp(6)); parent.addView(this)
    }
    fun buttonBackground(primary:Boolean) = GradientDrawable().apply {
      setColor(if(primary) Color.rgb(37,100,72) else if(dark) Color.rgb(40,64,49) else Color.rgb(232,237,219))
      cornerRadius=dp(16).toFloat()
      if(!primary) setStroke(dp(1),if(dark) Color.rgb(69,94,71) else Color.rgb(208,219,196))
    }
    fun styleButton(button:Button,primary:Boolean) { button.isAllCaps=false;button.minHeight=dp(52);button.setTextColor(if(primary) Color.WHITE else ink);button.background=buttonBackground(primary);button.setPadding(dp(18),dp(10),dp(18),dp(10)) }
    val header=LinearLayout(c).apply { orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL }
    header.setPadding(dp(24),dp(12),dp(24),dp(12))
    header.setBackgroundColor(paper)
    val brand=TextView(c).apply { text="✦  DEENPATH";textSize=11f;letterSpacing=.13f;setTextColor(if(dark) Color.rgb(211,192,138) else Color.rgb(132,110,62)) }
    header.addView(brand,LinearLayout.LayoutParams(0,-2,1f))
    val close = Button(c).apply { text = actionLabel(c, PrayerAction.CLOSE); styleButton(this,false); minHeight=dp(44);textSize=12f;setOnClickListener { action(PrayerAction.CLOSE) } }
    header.addView(close,LinearLayout.LayoutParams(-2,dp(44)))
    label(ReminderText.title(r), 25f).apply { typeface=Typeface.DEFAULT_BOLD;setPadding(0,dp(24),0,dp(8)) }
    label(timing(c,r), 14f).alpha=.8f
    val clockPanel=LinearLayout(c).apply {
      orientation=LinearLayout.VERTICAL;setPadding(dp(20),dp(14),dp(20),dp(17))
      background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(if(dark) Color.rgb(31,63,47) else Color.rgb(231,237,217),if(dark) Color.rgb(24,49,38) else Color.rgb(244,242,223))).apply {cornerRadius=dp(20).toFloat()}
    }
    content.addView(clockPanel,LinearLayout.LayoutParams(-1,-2).apply {topMargin=dp(18);bottomMargin=dp(16)})
    val caption = label("", 12f,clockPanel).apply {alpha=.8f}
    val timer = label("", 36f,clockPanel).apply { typeface=Typeface.create("sans-serif-light",Typeface.NORMAL);fontFeatureSettings="tnum" }
    val timeProgress=ProgressBar(c,null,android.R.attr.progressBarStyleHorizontal).apply {max=1000;progressTintList=android.content.res.ColorStateList.valueOf(if(dark) Color.rgb(178,199,141) else Color.rgb(74,116,77));progressBackgroundTintList=android.content.res.ColorStateList.valueOf(0x22648A62)}
    clockPanel.addView(timeProgress,LinearLayout.LayoutParams(-1,dp(4)).apply {topMargin=dp(8)})
    val end = runCatching { Instant.parse(r.getString("windowEnd")).toEpochMilli() }.getOrNull()
    val start = runCatching { Instant.parse(r.getString("windowStart")).toEpochMilli() }.getOrNull()
    label(r.optString("body"), 17f).apply { setLineSpacing(dp(5).toFloat(),1.12f) }
    val actions=LinearLayout(c).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(24),dp(8),dp(24),dp(8));setBackgroundColor(paper)}
    var complete: Button? = null
    val preview=r.optString("route")=="test"
    if((r.optString("route").startsWith("prayer:") || preview) && end != null) {
      complete = Button(c).apply {
        styleButton(this,true)
        setOnClickListener { if(preview)android.widget.Toast.makeText(c,text(c,"Preview only — no prayer recorded","صرف جھلک — نماز درج نہیں ہوئی","معاينة فقط — لم تسجل صلاة"),android.widget.Toast.LENGTH_SHORT).show() else {isEnabled=false; action(if(System.currentTimeMillis() >= end) PrayerAction.CLOSE else PrayerAction.PRAYED) } }
        actions.addView(this, LinearLayout.LayoutParams(-1,-2))
      }
    }
    if(preview)label(text(c,"Preview actions do not record worship.","جھلک کے بٹن عبادت درج نہیں کرتے۔","أزرار المعاينة لا تسجل العبادة."),12f)
    actions.addView(Button(c).apply {
      text=actionLabel(c,PrayerAction.SNOOZE); styleButton(this,false)
      setOnClickListener { isEnabled=false; action(PrayerAction.SNOOZE) }
    }, LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(12) })
    val handler=Handler(Looper.getMainLooper())
    val update=object:Runnable {
      override fun run() {
        val now=System.currentTimeMillis()
        val waiting=start!=null && now<start
        val target=if(waiting) start else end
        val remaining=if(target==null) 0L else ((target-now+999)/1000).coerceAtLeast(0)
        timeProgress.progress=if(start!=null && end!=null && end>start) (((now-start).toDouble()/(end-start))*1000).toInt().coerceIn(0,1000) else 0
        caption.text=if(end==null) "" else if(waiting) text(c,"Starts in","آغاز میں باقی","تبدأ خلال") else text(c,"Time remaining","باقی وقت","الوقت المتبقي")
        timer.text=if(end==null) text(c,"Test reminder", "آزمائشی یاد دہانی", "تذكير تجريبي")
          else if(remaining==0L) text(c,"Prayer time ended", "نماز کا وقت ختم", "انتهى وقت الصلاة")
          else String.format(java.util.Locale.ROOT,"%02d:%02d:%02d", remaining/3600,(remaining%3600)/60,remaining%60)
        timer.setTextColor(if(!waiting && remaining in 1..899) (if(dark) Color.rgb(245,197,108) else Color.rgb(132,83,12)) else ink)
        if(!preview)complete?.isEnabled=!waiting && end!=null && now<end
        complete?.text=actionLabel(c,PrayerAction.PRAYED)
        handler.postDelayed(this,1000)
      }
    }
    scroll.addOnAttachStateChangeListener(object:View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(v:View) { handler.post(update) }
      override fun onViewDetachedFromWindow(v:View) { handler.removeCallbacksAndMessages(null) }
    })
    return EnforcerInsets.apply(LinearLayout(c).apply {
      orientation=LinearLayout.VERTICAL;setBackgroundColor(paper);layoutDirection=content.layoutDirection
      addView(header,LinearLayout.LayoutParams(-1,dp(68)))
      addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
      addView(actions,LinearLayout.LayoutParams(-1,-2))
    })
  }
}
