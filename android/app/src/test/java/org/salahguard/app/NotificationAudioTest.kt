package org.salahguard.app

import org.junit.Assert.*
import org.junit.Test

class NotificationAudioTest {
  @Test fun reminderChannelsUseANewIdentityForNotificationAudioMigration(){
    assertTrue(NotificationAudio.key("gentle",false,true,"default").startsWith("sg_reminder_v3_"))
    assertTrue(NotificationAudio.key("routine",false,true,"default").startsWith("sg_v2_"))
  }

  @Test
  fun selectedSoundChangesTheImmutableChannelIdentity() {
    assertNotEquals(
      NotificationAudio.key("gentle", false, true, "content://sound/1"),
      NotificationAudio.key("gentle", false, true, "content://sound/2"),
    )
  }

  @Test
  fun identicalSelectionReusesItsChannel() {
    assertEquals(
      NotificationAudio.key("warning", false, true, "default"),
      NotificationAudio.key("warning", false, true, "default"),
    )
    assertNotEquals(
      NotificationAudio.key("warning", false, true, "default"),
      NotificationAudio.key("warning", true, true, "default"),
    )
  }
}
