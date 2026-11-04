package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.time.*
class WidgetModelTest {
 private fun root()=JSONObject("""{"settings":{"lat":24.8607,"lng":67.0011,"timezone":"Asia/Karachi","method":"Karachi","hanafi":true,"ishaEnd":"midnight"},"records":[],"queue":[]}""")
 @Test fun fourKindsHaveHonestEmptyStates() {
  for(kind in listOf("prayer","gems","collection","daily")) assertTrue(WidgetModel.projection(root(),kind,"Overall",Instant.parse("2026-10-30T07:30:00Z")).getString("title").isNotEmpty())
  assertTrue(WidgetModel.projection(root(),"collection").getString("body").contains("0 cards"))
 }
 @Test fun collectionCountsOwnedCopiesAndUniqueDefinitions(){
  val r=root();r.put("collectibles",JSONObject("""{"library":{"a":{"status":"published"},"b":{"status":"published"}},"copies":{"one":{"cardId":"a"},"two":{"cardId":"a"},"three":{"cardId":"b","hidden":true}}}"""));val model=WidgetModel.projection(r,"collection");assertEquals(1,model.getInt("done"));assertEquals(2,model.getInt("total"));assertTrue(model.getString("body").contains("2 cards"))
 }
 @Test fun privateRecordsAndSecretsAreNeverProjected() {
  val r=root();r.put("apiKey","secret-key");NativeRecords.put(r,"private_records","secret",JSONObject().put("note","private-reflection"))
  for(kind in listOf("prayer","gems","collection","daily")) { val output=WidgetModel.projection(r,kind).toString();assertFalse(output.contains("secret-key"));assertFalse(output.contains("private-reflection")) }
 }
 @Test fun nativeWindowsPreserveFridayAndConfiguredIshaBoundary() {
  val s=root().getJSONObject("settings");val day=LocalDate.parse("2026-10-30");val windows=PrayerWindows.calculate(day,s)
  assertEquals(5,windows.size);assertEquals("Dhuhr",windows[1].name)
  assertTrue(PrayerWindows.calculate(day,s.put("ishaEnd","fajr"))[4].end>windows[4].end)
 }
 @Test fun nativeWindowsHandleAdjustedTimesAndDstDates() {
  val s=root().getJSONObject("settings").put("adjustments",org.json.JSONArray("[1,2,3,4,5]"))
  for(zone in listOf("Asia/Karachi","Europe/London","America/New_York")) for(day in listOf("2026-03-29","2026-10-25","2026-10-30")) {
   s.put("timezone",zone)
   val windows=PrayerWindows.calculate(LocalDate.parse(day),s)
   assertEquals(5,windows.size);assertTrue(windows.all { it.end>it.start })
  }
  val adjusted=PrayerWindows.calculate(LocalDate.parse("2026-10-30"),s)
  val normal=PrayerWindows.calculate(LocalDate.parse("2026-10-30"),s.put("adjustments",org.json.JSONArray("[0,0,0,0,0]")))
  assertEquals(60000L,adjusted[0].start-normal[0].start)
  assertEquals(0L,adjusted[4].end-normal[4].end)
 }
 @Test fun nativeCompletionImmediatelyUpdatesWidgetCount() {
  val r=root();val w=PrayerWindows.calculate(LocalDate.parse("2026-10-30"),r.getJSONObject("settings"))[0]
  val event=JSONObject().put("route","prayer:"+w.id).put("windowStart",Instant.ofEpochMilli(w.start).toString()).put("windowEnd",Instant.ofEpochMilli(w.end).toString())
  PrayerActionRules.apply(r,event,PrayerAction.PRAYED,Instant.ofEpochMilli(w.start+1000))
  assertEquals(1,WidgetModel.projection(r,"daily","Overall",Instant.parse("2026-10-30T07:30:00Z")).getInt("done"))
 }
 private fun completeDay(r:JSONObject,day:LocalDate) {
  for(w in PrayerWindows.calculate(day,r.getJSONObject("settings"))) NativeRecords.put(r,"prayer_records",w.id,JSONObject().put("day",day.toString()).put("prayer",w.name).put("completedAt",Instant.ofEpochMilli(w.start+1000).toString()).put("windowStart",Instant.ofEpochMilli(w.start).toString()).put("windowEnd",Instant.ofEpochMilli(w.end).toString()))
 }
 @Test fun todayMissedOrQazaBreaksOverallStreakBeforeOtherPrayersAreDue() {
  for(status in listOf("unknown","missed","qaza")) {
   val r=root();r.getJSONObject("settings").put("trackingStart","2026-10-29")
   completeDay(r,LocalDate.parse("2026-10-29"))
   if(status!="unknown") NativeRecords.put(r,"prayer_records","2026-10-30:Fajr",JSONObject().put("status","missed").apply { if(status=="qaza") put("qazaAt","2026-10-30T03:00:00Z") })
   val model=WidgetModel.projection(r,"streak","Overall",Instant.parse("2026-10-30T07:30:00Z"))
   assertEquals(0,model.getInt("current"));assertEquals(1,model.getInt("best"))
  }
 }
 @Test fun openPrayerPreservesPriorStreakUntilItsWindowEnds() {
  val r=root();r.getJSONObject("settings").put("trackingStart","2026-10-29")
  completeDay(r,LocalDate.parse("2026-10-29"))
  val w=PrayerWindows.calculate(LocalDate.parse("2026-10-30"),r.getJSONObject("settings"))[0]
  assertEquals(1,WidgetModel.projection(r,"streak","Fajr",Instant.ofEpochMilli(w.start+1000)).getInt("current"))
  assertEquals(0,WidgetModel.projection(r,"streak","Fajr",Instant.ofEpochMilli(w.end)).getInt("current"))
 }
 @Test fun fridayDhuhrAndJummahUseTheSameSingleObligation() {
  val r=root();r.getJSONObject("settings").put("trackingStart","2026-10-30")
  completeDay(r,LocalDate.parse("2026-10-30"))
  val at=Instant.parse("2026-10-30T20:00:00Z")
  assertEquals(1,WidgetModel.projection(r,"streak","Jummah",at).getInt("current"))
  assertEquals(0,WidgetModel.projection(r,"streak","Dhuhr",at).getInt("current"))
  NativeRecords.record(r,"prayer_records","2026-10-30:Dhuhr")!!.getJSONObject("data").put("midday","Dhuhr")
  assertEquals(0,WidgetModel.projection(r,"streak","Jummah",at).getInt("current"))
  assertEquals(1,WidgetModel.projection(r,"streak","Dhuhr",at).getInt("current"))
 }
 @Test fun collectionDoesNotDependOnPrayerCoordinatesOrTimezone(){val r=root();r.getJSONObject("settings").put("lat",90).put("timezone","Invalid/Zone");assertTrue(WidgetModel.projection(r,"collection").getString("body").contains("0 cards"))}
 @Test fun gemWidgetShowsCanonicalBalanceAndPackReadiness(){val r=root();r.put("economy",JSONObject().put("balance",1250));val model=WidgetModel.projection(r,"gems");assertEquals(1250,model.getLong("amount"));assertEquals(500,model.getInt("done"));assertEquals(500,model.getInt("total"))}
 @Test fun recordedWindowsFeedNativeCountdownsAfterSettingsChange() {
  val r=root();val day=LocalDate.parse("2026-10-30");val w=PrayerWindows.calculate(day,r.getJSONObject("settings"))[1]
  val saved=JSONObject().put("windowStart","2026-10-30T07:00:00Z").put("windowEnd","2026-10-30T15:00:00Z")
  NativeRecords.put(r,"prayer_records",w.id,saved)
  assertEquals(Instant.parse("2026-10-30T15:00:00Z").toEpochMilli(),PrayerWindows.recorded(w,saved).end)
  val model=WidgetModel.projection(r,"prayer","Overall",Instant.parse("2026-10-30T12:00:00Z"))
  assertEquals(Instant.parse("2026-10-30T15:00:00Z").toEpochMilli(),model.getLong("target"))
 }

}
