package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.time.*

class PrayerActionsTest {
 private fun root()=JSONObject("""{"settings":{"timezone":"Asia/Karachi"},"records":[],"queue":[]}""")
 private fun event()=JSONObject("""{"id":"event","route":"prayer:2026-10-30:Fajr","windowStart":"2026-10-30T00:00:00Z","windowEnd":"2026-10-30T01:00:00Z"}""")
 @Test fun snoozeAndCloseCannotWriteWorship() {
  for(action in listOf(PrayerAction.SNOOZE,PrayerAction.CLOSE)) { val r=root();val before=r.toString();assertFalse(PrayerActionRules.apply(r,event(),action,Instant.parse("2026-10-30T00:30:00Z")));assertEquals(before,r.toString()) }
 }
 @Test fun prayedIsExplicitValidatedAndIdempotent() {
  val r=root();val at=Instant.parse("2026-10-30T00:30:00Z")
  assertTrue(PrayerActionRules.apply(r,event(),PrayerAction.PRAYED,at))
  val before=r.toString();assertFalse(PrayerActionRules.apply(r,event(),PrayerAction.PRAYED,at));assertEquals(before,r.toString())
  assertFalse(PrayerActionRules.apply(r,event(),PrayerAction.QAZA,at.plusSeconds(3600)))
 }
 @Test fun specificQazaIsExactlyOnceAndNeverOnTime() {
  val r=root();val at=Instant.parse("2026-10-30T01:00:00Z")
  assertTrue(PrayerActionRules.apply(r,event(),PrayerAction.QAZA,at))
  val before=r.toString();assertFalse(PrayerActionRules.apply(r,event(),PrayerAction.QAZA,at));assertEquals(before,r.toString())
  val data=NativeRecords.record(r,"prayer_records","2026-10-30:Fajr")!!.getJSONObject("data")
  assertTrue(data.isNull("completedAt"));assertEquals(at.toString(),data.getString("qazaAt"))
  assertNotNull(NativeRecords.record(r,"qaza_records","2026-10-30:Fajr"))
 }
 @Test(expected=IllegalArgumentException::class) fun refusesEarlyPrayer() { PrayerActionRules.apply(root(),event(),PrayerAction.PRAYED,Instant.parse("2026-10-29T23:59:59Z")) }
 @Test(expected=IllegalArgumentException::class) fun refusesEarlyQaza() { PrayerActionRules.apply(root(),event(),PrayerAction.QAZA,Instant.parse("2026-10-30T00:30:00Z")) }
 @Test fun rejectsAmbiguousQazaIdentity() { assertTrue(runCatching { PrayerActionRules.apply(root(),event().put("route","prayer:Qaza"),PrayerAction.QAZA,Instant.now()) }.isFailure) }
 @Test fun staleNotificationAndCrossAccountActionsAreRejected() {
  val current=event().put("owner","account-a")
  assertTrue(ReminderEventRules.active(current,JSONObject(current.toString()),"account-a"))
  assertFalse(ReminderEventRules.active(current,JSONObject(current.toString()).put("id","old-event"),"account-a"))
  assertFalse(ReminderEventRules.active(current,current,"account-b"))
  assertFalse(ReminderEventRules.active(null,current,"account-a"))
  assertFalse(ReminderEventRules.active(JSONObject(current.toString()).put("handled",true),current,"account-a"))
 }
 @Test fun sensorMathUsesTrueNorthAndDisplayRotation() {
  assertEquals(1.0,HeadingMath.trueNorth(359.0,2.0),0.0001)
  assertEquals(359.0,HeadingMath.trueNorth(1.0,-2.0),0.0001)
  assertEquals(2 to 129,HeadingMath.axes(1));assertEquals(129 to 130,HeadingMath.axes(2));assertEquals(130 to 1,HeadingMath.axes(3));assertEquals(1 to 2,HeadingMath.axes(0))
 }
 @Test fun savedWindowSurvivesChangedCalculationPayload() {
  val r=root()
  NativeRecords.put(r,"prayer_records","2026-10-30:Fajr",JSONObject("""{"windowStart":"2026-10-30T00:00:00Z","windowEnd":"2026-10-30T02:00:00Z","timezone":"UTC"}"""))
  val at=Instant.parse("2026-10-30T01:30:00Z")
  assertTrue(runCatching { PrayerActionRules.apply(r,event(),PrayerAction.QAZA,at) }.isFailure)
  assertTrue(PrayerActionRules.apply(r,event(),PrayerAction.PRAYED,at))
  val data=NativeRecords.record(r,"prayer_records","2026-10-30:Fajr")!!.getJSONObject("data")
  assertEquals("2026-10-30T02:00:00Z",data.getString("windowEnd"));assertEquals("UTC",data.getString("timezone"))
 }
 @Test fun calculationChangesInvalidateEventsButSoundAndLanguageDoNot() {
  val settings=JSONObject("""{"lat":24.8607,"lng":67.0011,"method":"Karachi","timezone":"Asia/Karachi","hanafi":true}""")
  val e=event().put("calculation",ReminderConfiguration.key(settings))
  val firstId=ReminderConfiguration.eventId("prayer:gentle:123","a",settings)
  assertEquals(firstId,ReminderConfiguration.eventId("prayer:gentle:123","a",settings.put("lang","ur").put("silent",true)))
  assertNotEquals(firstId,ReminderConfiguration.eventId("prayer:gentle:123","b",settings))
  assertTrue(ReminderConfiguration.matches(e,settings))
  for((key,value) in listOf("lat" to 51.5,"lng" to -0.1,"method" to "Egyptian","timezone" to "Europe/London","hanafi" to false,"ishaEnd" to "fajr")) {
   val changed=JSONObject(settings.toString()).put(key,value)
   assertFalse(ReminderConfiguration.matches(e,changed))
   assertNotEquals(firstId,ReminderConfiguration.eventId("prayer:gentle:123","a",changed))
  }
  assertFalse(ReminderConfiguration.matches(e,JSONObject(settings.toString()).put("adjustments",org.json.JSONArray("[1,0,0,0,0]"))))
 }
 @Test fun schedulerSideEffectsNeverHoldTheSnapshotMonitor() {
  val lock=Any();var called=false
  val result=ReminderActionExecution.run(lock,prepare={assertTrue(Thread.holdsLock(lock));42},finish={value->assertFalse(Thread.holdsLock(lock));assertEquals(42,value);called=true})
  assertTrue(called);assertEquals(42,result)
 }

}
