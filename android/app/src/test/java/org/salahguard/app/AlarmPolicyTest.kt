package org.salahguard.app

import org.junit.Assert.*
import org.junit.Test

class AlarmPolicyTest {
  @Test
  fun repeatedLargePlansNeverReachThePlatformAlarmLimit() {
    var active = 0
    var maximum = 0
    val driver =
      object : AlarmPolicy.Driver {
        override fun cancel() {
          active = 0
        }

        override fun schedule(at: Long) {
          active++
          maximum = maxOf(maximum, active)
          if (active > 500)
            throw IllegalStateException("Maximum limit of concurrent alarms 500 reached")
        }
      }
    repeat(1000) { AlarmPolicy.arm(1000, (1..1000).map { it * 1000L }, driver) }
    assertEquals(1, maximum)
    AlarmPolicy.arm(1000, emptyList(), driver)
    assertEquals(0, active)
  }

  @Test
  fun largePrayerAndRoutinePlanUsesOneOsAlarm() {
    val plan = (1..10000).map { 1000L + it * 1000 }
    assertEquals(1, AlarmPolicy.MAX_OS_ALARMS)
    assertEquals(2000L, AlarmPolicy.nextTrigger(1000, plan))
    assertEquals(1, AlarmPolicy.MAX_OS_ALARMS)
  }

  @Test
  fun emptyPlanCancelsDispatch() {
    assertNull(AlarmPolicy.nextTrigger(1000, emptyList()))
  }

  @Test
  fun overduePlanRunsPromptlyWithoutSchedulingInThePast() {
    assertEquals(1500L, AlarmPolicy.nextTrigger(1000, listOf(50, 900)))
  }

  @Test fun wakingAfterDelayShowsOnlyLatestPerPrayer(){
    fun row(route:String,at:Long)=org.json.JSONObject().put("route",route).put("at",at)
    val now=3600000L;val result=AlarmPolicy.latestDue(listOf(row("prayer:a",now-600000),row("prayer:a",now-60000),row("prayer:b",now-20000),row("prayer:c",0),row("prayer:d",now+60000)),now)
    assertEquals(2,result.size);assertEquals(now-60000,result.first{it.getString("route")=="prayer:a"}.getLong("at"))
  }
  @Test fun snoozeBlocksDenseRepeatsUntilItsExactDeadline(){assertTrue(AlarmPolicy.snoozed(999,1000));assertFalse(AlarmPolicy.snoozed(1000,1000));assertFalse(AlarmPolicy.snoozed(1001,1000))}
}
