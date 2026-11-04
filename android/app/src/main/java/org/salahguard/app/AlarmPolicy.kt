package org.salahguard.app
/** One OS alarm drives an arbitrarily sized SQLite queue. */
object AlarmPolicy {
  interface Driver {
    fun cancel()

    fun schedule(at: Long)
  }

  const val MAX_OS_ALARMS = 1
  const val PLAN_DAYS = 7
  const val STALE_MILLIS = 30 * 60 * 1000L

  fun keepQueued(now: Long, at: Long, id: String): Boolean {
    val age = now - at
    return age in 0..STALE_MILLIS || (age < 0 && (id.startsWith("test:") || id.contains(":snooze")))
  }

  fun latestDue(rows:List<org.json.JSONObject>,now:Long)=rows.filter{it.getLong("at")<=now+500&&now-it.getLong("at")<=STALE_MILLIS}.groupBy{it.optString("route")}.values.map{group->group.maxBy{it.getLong("at")}}
  fun snoozed(now:Long,until:Long)=now<until

  fun nextTrigger(now: Long, times: List<Long>): Long? =
    times.minOrNull()?.let { maxOf(now + 500, it) }

  fun arm(now: Long, times: List<Long>, driver: Driver) {
    driver.cancel()
    nextTrigger(now, times)?.let { driver.schedule(it) }
  }
}
