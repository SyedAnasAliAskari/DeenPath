package org.salahguard.app

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import org.json.JSONObject

/** Does not dismiss the keyguard or grant access to the app's private screens. */
class LockEnforcerActivity: Activity() {
  private var handled:android.content.BroadcastReceiver?=null
  private val handler=Handler(Looper.getMainLooper())
  override fun onCreate(savedInstanceState:Bundle?) {
    super.onCreate(savedInstanceState)
    ReminderDiagnostics.record(this,"lock_enforcer_created")
    val r=runCatching { JSONObject(intent.getStringExtra("payload") ?: "") }.getOrNull()
    if(r==null || !PrayerActions.active(this,r)) { finish(); return }
    handled=object:android.content.BroadcastReceiver(){override fun onReceive(c:android.content.Context,i:android.content.Intent){if(i.getStringExtra("handledRoute")==r.optString("route"))finish()}}
    androidx.core.content.ContextCompat.registerReceiver(this,handled,android.content.IntentFilter(NativeSignals.STORE_CHANGED),androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED)
    if(r.optString("route")=="private")window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
    setShowWhenLocked(true)
    setTurnScreenOn(NotificationAudio.settings(this).optBoolean("wakeEnforcer",false))
    setContentView(EnforcerUi.create(this,r) { action -> Thread {
      runCatching { PrayerActions.dispatch(this,r,action) }.onFailure { error -> handler.post {
        android.widget.Toast.makeText(this,error.message ?: NativeUi.text(this,"saveFailed"),android.widget.Toast.LENGTH_LONG).show()
      } }
      runOnUiThread { finish() }
    }.start() })
    val check=object:Runnable { override fun run() {
      if(!PrayerActions.active(this@LockEnforcerActivity,r)) finish() else handler.postDelayed(this,1000)
    } }
    handler.post(check)
  }
  override fun onNewIntent(next:android.content.Intent){super.onNewIntent(next);handler.removeCallbacksAndMessages(null);intent=next;recreate()}
  override fun onResume(){super.onResume();handler.postDelayed({val power=getSystemService(POWER_SERVICE) as android.os.PowerManager;ReminderDiagnostics.record(this,"lock_enforcer_resumed_interactive_"+power.isInteractive)},150)}
  override fun onDestroy() { handled?.let{runCatching{unregisterReceiver(it)}};handled=null;handler.removeCallbacksAndMessages(null); super.onDestroy() }
}
