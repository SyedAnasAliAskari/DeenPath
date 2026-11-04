package org.salahguard.app
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
/** Keep both timed and lock-screen actions above navigation bars and gesture targets. */
object EnforcerInsets {
 fun <T:View> apply(view:T):T {
  val density=view.resources.displayMetrics.density
  val gap=(16*density).toInt();val fallback=(24*density).toInt()
  view.setPadding(0,0,0,fallback+gap)
  ViewCompat.setOnApplyWindowInsetsListener(view){target,insets->val bars=insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout());target.setPadding(bars.left,bars.top,bars.right,maxOf(bars.bottom,fallback)+gap);insets}
  view.addOnAttachStateChangeListener(object:View.OnAttachStateChangeListener{override fun onViewAttachedToWindow(v:View){ViewCompat.requestApplyInsets(v)};override fun onViewDetachedFromWindow(v:View){}})
  return view
 }
}
