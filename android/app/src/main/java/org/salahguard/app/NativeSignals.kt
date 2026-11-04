package org.salahguard.app

import android.content.Context
import android.content.Intent

object NativeSignals {
  const val STORE_CHANGED = "org.salahguard.app.STORE_CHANGED"

  fun changed(c: Context, handledRoute:String?=null) {
    WidgetUpdates.request(c)
    c.sendBroadcast(Intent(STORE_CHANGED).setPackage(c.packageName).apply{if(handledRoute!=null)putExtra("handledRoute",handledRoute)})
  }
}
