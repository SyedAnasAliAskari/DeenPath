package org.salahguard.app
import android.content.*
import android.app.KeyguardManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.view.View
import android.widget.*
import org.json.*
import java.time.*
object SecretEnforcerUi {
 fun create(c:Context,event:JSONObject,close:(PrayerAction)->Unit):View {
  val settings=NotificationAudio.settings(c);val dark=settings.optString("appearance")=="dark"||(settings.optString("appearance","system")=="system"&&(c.resources.configuration.uiMode and 48)==32)
  val ink=Color.parseColor(if(dark)"#EFF3E8" else "#193E32");val paper=Color.parseColor(if(dark)"#142B22" else "#FFFEF7")
  fun dp(n:Int)=(n*c.resources.displayMetrics.density).toInt()
  val scroll=ScrollView(c).apply{isFillViewport=true;setBackgroundColor(paper)};val content=LinearLayout(c).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(24),dp(25),dp(24),dp(30));background=GradientDrawable().apply{setColor(paper);cornerRadius=0f};layoutDirection=if(settings.optString("lang","en")=="en")View.LAYOUT_DIRECTION_LTR else View.LAYOUT_DIRECTION_RTL};scroll.addView(content)
  val footer=LinearLayout(c).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(24),dp(8),dp(24),dp(8));setBackgroundColor(paper)}
  val handler=Handler(Looper.getMainLooper());var busy=false;var gateWasOpen=false
  fun text(en:String,ur:String,ar:String)=EnforcerUi.text(c,en,ur,ar)
  fun label(value:String,size:Float){content.addView(TextView(c).apply{text=value;textSize=size;setTextColor(ink);setPadding(0,dp(10),0,dp(10));if(size>=24)typeface=Typeface.DEFAULT_BOLD})}
  fun button(title:String,primary:Boolean,parent:LinearLayout=content,fn:()->Unit){parent.addView(Button(c).apply{text=title;isAllCaps=false;minHeight=dp(54);setTextColor(if(primary)Color.WHITE else ink);background=GradientDrawable().apply{setColor(if(primary)Color.rgb(33,103,73) else if(dark)Color.rgb(39,64,47) else Color.rgb(230,237,219));cornerRadius=dp(16).toFloat()};setOnClickListener{fn()}},LinearLayout.LayoutParams(-1,-2).apply{topMargin=dp(12)})}
  fun openSecrets(){c.startActivity(Intent(c,MainActivity::class.java).putExtra("reminder","private").setData(android.net.Uri.parse("salahguard://secrets/checkin")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP));close(PrayerAction.CLOSE)}
  lateinit var render:()->Unit
  render={
   content.removeAllViews();label("✦  DEENPATH · "+text("SECRETS","راز","الأسرار"),12f)
   val preview=event.optBoolean("testSecrets");val locked=(c.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked||!DeenPrivacy.status(c).optBoolean("unlocked")
   gateWasOpen=!locked
   if(preview){label(text("Did you do the deed today?","کیا آج آپ سے یہ عمل ہوا؟","هل فعلت هذا اليوم؟"),27f);label(text("Preview only. No answer, point or penalty will be saved.","صرف جھلک۔ جواب، پوائنٹ یا عہد محفوظ نہیں ہوگا۔","معاينة فقط. لن تحفظ إجابة أو نقطة أو التزام."),15f)
    for(yes in listOf(false,true))button(if(yes)text("Yes, I did","ہاں، مجھ سے ہوا","نعم، فعلته") else text("No, I avoided it","نہیں، میں نے اجتناب کیا","لا، تجنبته"),!yes){Toast.makeText(c,text("Preview only — nothing recorded","صرف جھلک — کچھ درج نہیں ہوا","معاينة فقط — لم يسجل شيء"),Toast.LENGTH_SHORT).show()}
   }else if(locked){label(text("Your private daily check-in","آپ کا روزانہ نجی سوال","تسجيلك اليومي الخاص"),27f);label(text("Unlock Secrets to answer privately. Names and descriptions stay hidden while locked.","نجی جواب کے لیے راز کھولیں۔ قفل کے دوران نام اور تفصیل مخفی ہیں۔","افتح الأسرار للإجابة بخصوصية. تبقى الأسماء والأوصاف مخفية عند القفل."),17f);button(text("Unlock Secrets","راز کھولیں","فتح الأسرار"),true){openSecrets()}
   }else{
    val root=LocalDatabase(c).use{JSONObject(it.load())};val items=runCatching{SecretActions.items(c,root)}.getOrDefault(emptyList());val day=event.optString("checkinDay").ifBlank{LocalDate.now(ZoneId.of(settings.getString("timezone"))).toString()}
    val habit=items.firstOrNull{h->h.optString("type")=="habit"&&!h.optBoolean("archived")&&h.optString("start")<=day&&items.none{it.optString("type")=="checkin"&&it.optString("habitId")==h.optString("id")&&it.optString("day")==day&&it.optString("state") in listOf("avoided","slipped")}}
    if(habit==null){label(text("Your check-ins are complete","آپ کے اندراجات مکمل ہیں","اكتملت تسجيلاتك"),26f);label(text("Every honest step matters.","ہر سچی کوشش اہم ہے۔","كل خطوة صادقة مهمة."),17f)}else{
     label(habit.optString("name"),27f);label(habit.optString("description"),16f);label(text("Did you do this deed today?","کیا آج آپ سے یہ عمل ہوا؟","هل فعلت هذا اليوم؟"),20f)
     for(state in listOf("avoided","slipped"))button(if(state=="avoided")text("No, I avoided it","نہیں، میں نے اجتناب کیا","لا، تجنبته") else text("Yes, I did","ہاں، مجھ سے ہوا","نعم، فعلته"),state=="avoided"){
      if(!busy){busy=true;Thread{try{val owner=root.optString("owner").let{if(it=="null")"" else it};val changed=SecretActions.answer(c,owner,habit.getString("id"),day,state,event);handler.post{Toast.makeText(c,if(!changed)text("Already saved","پہلے محفوظ ہے","محفوظ مسبقًا") else if(state=="avoided")text("Saved · avoidance streak updated","محفوظ · اجتناب کا تسلسل تازہ ہو گیا","حفظ · تم تحديث تتابع الاجتناب") else text("Your penalty is ready","آپ کا عہد تیار ہے","التزامك جاهز"),Toast.LENGTH_SHORT).show();busy=false;render()}}catch(e:Exception){handler.post{busy=false;Toast.makeText(c,e.message,Toast.LENGTH_LONG).show();render()}}}.start()}
     }
    }
   }

  }
  button(text("Remind me later","بعد میں یاد دلائیں","ذكرني لاحقًا"),false,footer){close(PrayerAction.SNOOZE)};button(text("Close","بند کریں","إغلاق"),false,footer){close(PrayerAction.CLOSE)}
  render();val check=object:Runnable{override fun run(){if(gateWasOpen&&((c.getSystemService(Context.KEYGUARD_SERVICE)as KeyguardManager).isKeyguardLocked||!DeenPrivacy.status(c).optBoolean("unlocked")))render();handler.postDelayed(this,1000)}}
  scroll.addOnAttachStateChangeListener(object:View.OnAttachStateChangeListener{override fun onViewAttachedToWindow(v:View){handler.post(check)};override fun onViewDetachedFromWindow(v:View){handler.removeCallbacksAndMessages(null)}});return EnforcerInsets.apply(LinearLayout(c).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(paper);addView(scroll,LinearLayout.LayoutParams(-1,0,1f));addView(footer,LinearLayout.LayoutParams(-1,-2))})
 }
}
