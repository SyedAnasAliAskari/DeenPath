package org.salahguard.app

import org.junit.Assert.*
import org.junit.Test

class ReminderQueueTest {
  @Test fun dueReminderSurvivesAnEditAtTheSameTimeAsDelivery() {
    assertTrue(AlarmPolicy.keepQueued(10000, 9990, "routine:due"))
    assertTrue(AlarmPolicy.keepQueued(10000, 10000, "prayer:due"))
    assertFalse(AlarmPolicy.keepQueued(10000 + AlarmPolicy.STALE_MILLIS + 1, 10000, "old"))
  }
  @Test fun cancelledFuturePlansAreReplacedButTestAndSnoozeSurvive() {
    assertFalse(AlarmPolicy.keepQueued(10000, 15000, "routine:deleted"))
    assertTrue(AlarmPolicy.keepQueued(10000, 15000, "test:notification"))
    assertTrue(AlarmPolicy.keepQueued(10000, 15000, "prayer:snooze"))
  }
}
