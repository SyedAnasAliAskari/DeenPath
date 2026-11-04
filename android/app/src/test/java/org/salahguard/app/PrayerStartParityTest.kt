package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONArray
import java.time.LocalDate
class PrayerStartParityTest {
 @Test fun nativeStartsMatchClientFixtures() {
  val rows=JSONArray(javaClass.classLoader!!.getResourceAsStream("prayer-starts.json")!!.bufferedReader().readText())
  for(i in 0 until rows.length()) {val row=rows.getJSONObject(i);val settings=row.getJSONObject("settings").put("ishaEnd","fajr").put("timezone","UTC");val actual=PrayerWindows.starts(LocalDate.parse(row.getString("day")),settings);for(w in actual)assertEquals("case $i "+settings.getString("method")+" "+w.name,row.getJSONObject("expected").getLong(w.name)*1000,w.start)}
 }
}
