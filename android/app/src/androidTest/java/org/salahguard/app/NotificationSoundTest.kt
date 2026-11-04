package org.salahguard.app
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class NotificationSoundTest {
 @Test fun reminderUsesNotificationAudioAndSilentVariantStaysSilent(){
  val c=InstrumentationRegistry.getInstrumentation().targetContext
  val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  val id=NotificationAudio.ensure(c,"test",false,true)
  val channel=manager.getNotificationChannel(id)
  assertEquals(AudioAttributes.USAGE_NOTIFICATION,channel.audioAttributes.usage)
  assertNotNull(channel.sound)
  val muted=NotificationAudio.ensure(c,"test",true,true)
  assertNull(manager.getNotificationChannel(muted).sound)
 }
}
