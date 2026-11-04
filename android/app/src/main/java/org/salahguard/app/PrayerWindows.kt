package org.salahguard.app
import com.batoulapps.adhan.*
import com.batoulapps.adhan.data.DateComponents
import java.time.*
import org.json.JSONObject

data class NativePrayerWindow(val name:String,val day:LocalDate,val start:Long,val end:Long) { val id:String get()="$day:$name" }
/** The native scheduler and launcher widgets use this one calculation source. */
object PrayerWindows {
 fun recorded(window: NativePrayerWindow, data: JSONObject?): NativePrayerWindow {
  if (data == null) return window
  val start=data.optString("windowStart").takeIf { it.isNotEmpty() }?.let { Instant.parse(it).toEpochMilli() } ?: window.start
  val end=data.optString("windowEnd").takeIf { it.isNotEmpty() }?.let { Instant.parse(it).toEpochMilli() } ?: window.end
  require(end>start) { "Saved prayer window is invalid" }
  return window.copy(start=start,end=end)
 }

 private fun times(day:LocalDate,s:JSONObject):PrayerTimes {
  val method=when(s.optString("method")) {
   "UmmAlQura"->CalculationMethod.UMM_AL_QURA; "Dubai"->CalculationMethod.DUBAI
   "MuslimWorldLeague"->CalculationMethod.MUSLIM_WORLD_LEAGUE; "Egyptian"->CalculationMethod.EGYPTIAN
   "NorthAmerica"->CalculationMethod.NORTH_AMERICA; "MoonsightingCommittee"->CalculationMethod.MOON_SIGHTING_COMMITTEE
   "Singapore"->CalculationMethod.SINGAPORE; else->CalculationMethod.KARACHI
  }
  val params=method.parameters.apply {madhab=if(s.optBoolean("hanafi",true))Madhab.HANAFI else Madhab.SHAFI}
  return PrayerTimes(Coordinates(s.optDouble("lat",24.8607),s.optDouble("lng",67.0011)),DateComponents(day.year,day.monthValue,day.dayOfMonth),params)
 }
 private fun millis(date:java.util.Date)=date.time/1000L*1000L
 // adhan-java 1.2.1 rounds Singapore to nearest; the frontend uses the method's upward rounding.
 private fun singapore(day:LocalDate,s:JSONObject):Map<String,Long> {
  val coordinates=Coordinates(s.getDouble("lat"),s.getDouble("lng"))
  fun components(d:LocalDate)=DateComponents(d.year,d.monthValue,d.dayOfMonth)
  val solar=com.batoulapps.adhan.internal.SolarTime(components(day),coordinates)
  val tomorrow=com.batoulapps.adhan.internal.SolarTime(components(day.plusDays(1)),coordinates)
  fun raw(hour:Double,d:LocalDate=day):Long?=com.batoulapps.adhan.data.TimeComponents.fromDouble(hour)?.dateComponents(components(d))?.let {millis(it)}
  val sunrise=raw(solar.sunrise) ?: error("Prayer start unavailable")
  val sunset=raw(solar.sunset) ?: error("Prayer start unavailable")
  val nextRise=raw(tomorrow.sunrise,day.plusDays(1)) ?: error("Prayer start unavailable")
  val night=nextRise-sunset
  val fajr=maxOf(raw(solar.hourAngle(-20.0,false)) ?: Long.MIN_VALUE,sunrise-night/2)
  val isha=minOf(raw(solar.hourAngle(-18.0,true)) ?: Long.MAX_VALUE,sunset+night/2)
  val shadow=if(s.optBoolean("hanafi",true))com.batoulapps.adhan.internal.ShadowLength.DOUBLE else com.batoulapps.adhan.internal.ShadowLength.SINGLE
  val values=mapOf("Fajr" to fajr,"Sunrise" to sunrise,"Dhuhr" to ((raw(solar.transit) ?: error("Prayer start unavailable"))+60000),"Asr" to (raw(solar.afternoon(shadow)) ?: error("Prayer start unavailable")),"Maghrib" to sunset,"Isha" to isha)
  return values.mapValues {(_,at)->(at/60000+1)*60000}
 }
 fun starts(day:LocalDate,s:JSONObject):List<NativePrayerStart> {
  if(s.optString("method")=="Singapore") {
    val base=singapore(day,s)
    return listOf("Fajr","Dhuhr","Asr","Maghrib","Isha").mapIndexed {i,name->NativePrayerStart(name,day,base.getValue(name)+(s.optJSONArray("adjustments")?.optInt(i,0)?:0)*60000L)}
  }
  val t=times(day,s)
  return listOf("Fajr","Dhuhr","Asr","Maghrib","Isha").zip(listOf(t.fajr,t.dhuhr,t.asr,t.maghrib,t.isha)).mapIndexed {i,(name,date)->NativePrayerStart(name,day,millis(date)+(s.optJSONArray("adjustments")?.optInt(i,0)?:0)*60000L)}
 }
 fun calculate(day:LocalDate,s:JSONObject):List<NativePrayerWindow> {
  val t=times(day,s);val n=times(day.plusDays(1),s)
  val starts=starts(day,s).map {it.start}
  val special=if(s.optString("method")=="Singapore")singapore(day,s) else null
  val nextFajr=if(special!=null)singapore(day.plusDays(1),s).getValue("Fajr") else millis(n.fajr)
  val maghrib=special?.get("Maghrib") ?: millis(t.maghrib)
  val ends=listOf(special?.get("Sunrise") ?: millis(t.sunrise),starts[2],starts[3],starts[4],if(s.optString("ishaEnd")=="fajr")nextFajr else maghrib+(nextFajr-maghrib)/2)
  return listOf("Fajr","Dhuhr","Asr","Maghrib","Isha").mapIndexed {i,name->require(ends[i]>starts[i]){"Prayer ending time unavailable"};NativePrayerWindow(name,day,starts[i],ends[i])}
 }
}
data class NativePrayerStart(val name:String,val day:LocalDate,val start:Long) {val id:String get()="$day:$name"}
