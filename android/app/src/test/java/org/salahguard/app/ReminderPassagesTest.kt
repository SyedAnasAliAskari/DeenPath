package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
import org.json.*
class ReminderPassagesTest {
 private fun bank()=JSONObject(javaClass.classLoader!!.getResourceAsStream("reminder-passages.json")!!.bufferedReader().use{it.readText()}).getJSONArray("entries")
 @Test fun everyThemeVariesWithoutConsecutiveDuplicates(){val b=bank();for(theme in listOf("balanced","hope","forgiveness","prayer")){var last="";for(n in 0L..50L){val row=PassageRotation.pick(b,theme,n,last);assertNotEquals(last,row.getString("id"));if(theme!="balanced")assertTrue(row.getJSONArray("themes").toString().contains(theme));last=row.getString("id")}}}
 @Test fun hadithMeaningsAreBilingualAndNeverPresentedAsFullLiteralTranslations(){val b=bank();for(i in 0 until b.length()){val row=b.getJSONObject(i);if(row.getString("kind")!="hadith")continue;val text=PassageRotation.hadith(row,"both");assertTrue(text.contains(row.getString("enSummary")));assertTrue(text.contains(row.getString("urSummary")));assertTrue(text.contains("Meaning (summary)"));assertTrue(text.contains("Arabic excerpt"));assertTrue(text.contains(row.getString("source")))}}
}
