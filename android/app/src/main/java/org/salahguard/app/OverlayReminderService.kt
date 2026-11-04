package org.salahguard.app

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.FrameLayout
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/** Short-lived opt-in overlay; ordinary background Activities are never used for unlocked delivery. */
class OverlayReminderService : Service() {
  private var panel: View? = null
  private var current: JSONObject? = null
  private val handler=Handler(Looper.getMainLooper())
  companion object {
    @Volatile private var active: OverlayReminderService? = null
    fun visible(): Boolean = active?.panel != null
    fun refresh(c:Context) { active?.let { service -> service.handler.post {
      val r=service.current
      if(r!=null && (!PrayerActions.active(c,r) || !NotificationAudio.settings(c).optBoolean("overlay") && !r.optBoolean("testOverlay") || !ReminderScheduler.shouldNotify(c,r.optString("route")))) service.stopSelf()
    } } }
    fun tryShow(c:Context,r:JSONObject):Boolean {
      ReminderDiagnostics.record(c,"overlay_requested")
      if(!Settings.canDrawOverlays(c)) { ReminderDiagnostics.record(c,"overlay_permission_denied"); return false }
      if((c.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked) { ReminderDiagnostics.record(c,"overlay_keyguard_fallback"); return false }
      if(!NotificationAudio.settings(c).optBoolean("overlay") && !r.optBoolean("testOverlay")) { ReminderDiagnostics.record(c,"overlay_setting_disabled"); return false }
      return try {
        c.startForegroundService(Intent(c,OverlayReminderService::class.java).putExtra("payload",r.toString())); true
      } catch(error:Exception) { android.util.Log.w("DeenPath","Overlay start restricted; notification remains available",error); false }
    }
  }
  override fun onBind(intent:Intent?) = null
  override fun onCreate() { super.onCreate(); active=this }
  override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
    ReminderDiagnostics.record(this,"overlay_service_started")
    val r=runCatching { JSONObject(intent?.getStringExtra("payload") ?: "") }.getOrNull()
    if(r==null) { stopSelf(); return START_NOT_STICKY }
    val notification=NotificationCompat.Builder(this,"sg_overlay_v2").setSmallIcon(R.drawable.ic_notification)
      .setContentTitle("DeenPath").setContentText(ReminderText.title(r)).setSilent(true).build()
    try {
      if(Build.VERSION.SDK_INT>=34) startForeground(2503,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(2503,notification)
      if(!Settings.canDrawOverlays(this)) { ReminderDiagnostics.record(this,"overlay_service_permission_denied"); stopSelf(); return START_NOT_STICKY }
      if(!PrayerActions.active(this,r)) { ReminderDiagnostics.record(this,"overlay_service_event_invalid"); stopSelf(); return START_NOT_STICKY }
      removePanel(); current=r
      val frame=FrameLayout(this).apply { setBackgroundColor(android.graphics.Color.rgb(19,42,34)); isFocusableInTouchMode=true }
      val content=EnforcerUi.create(this,r) { action -> Thread {
        runCatching { PrayerActions.dispatch(this,r,action) }.onFailure { error -> handler.post {
          android.widget.Toast.makeText(this,error.message ?: NativeUi.text(this,"saveFailed"),android.widget.Toast.LENGTH_LONG).show()
        } }
        handler.post { stopSelf() }
      }.start() }
      val height=resources.displayMetrics.heightPixels
      content.translationY = if(android.animation.ValueAnimator.areAnimatorsEnabled()) height.toFloat() else 0f
      frame.addView(content,FrameLayout.LayoutParams(-1,-1))
      val params=WindowManager.LayoutParams(-1,-1,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or (if(r.optString("route")=="private")WindowManager.LayoutParams.FLAG_SECURE else 0),PixelFormat.TRANSLUCENT).apply { gravity=Gravity.FILL; if(Build.VERSION.SDK_INT>=30)setFitInsetsTypes(0) }
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(frame,params)
      panel=frame
      ReminderDiagnostics.record(this,"overlay_visible")
      frame.setOnKeyListener { _,key,event -> if(key==KeyEvent.KEYCODE_BACK && event.action==KeyEvent.ACTION_UP) {
        Thread { PrayerActions.dispatch(this,r,PrayerAction.CLOSE) }.start(); stopSelf(); true
      } else false }
      frame.requestFocus()
      content.post {
        if(android.animation.ValueAnimator.areAnimatorsEnabled()) {
          content.translationY=height.toFloat(); content.animate().translationY(0f).setDuration(320)
            .setInterpolator(android.view.animation.DecelerateInterpolator()).start()
        }
      }
      val check=object:Runnable { override fun run() {
        if(!PrayerActions.active(this@OverlayReminderService,r) || (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked) stopSelf()
        else handler.postDelayed(this,1000)
      } }
      handler.post(check)
      handler.postDelayed({ stopSelf() },180000)
    } catch(error:Exception) { android.util.Log.w("DeenPath","Overlay unavailable; notification fallback",error); stopSelf() }
    return START_NOT_STICKY
  }
  private fun removePanel() { handler.removeCallbacksAndMessages(null); panel?.let { runCatching { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it) } }; panel=null }
  override fun onDestroy() { ReminderDiagnostics.record(this,"overlay_stopped"); removePanel(); active=null; stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy() }
}
