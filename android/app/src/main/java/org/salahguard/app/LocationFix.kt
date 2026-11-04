package org.salahguard.app
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.*
import android.os.*
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import java.util.concurrent.atomic.AtomicBoolean
object LocationFixRules {
 fun usable(lat:Double,lng:Double,ageMs:Long,accuracy:Float)=lat.isFinite()&&lng.isFinite()&&lat in -90.0..90.0&&lng in -180.0..180.0&&ageMs in 0..900000&&accuracy.isFinite()&&accuracy in 0f..10000f
}
object LocationFix {
 @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
 fun locate(c:Context,call:PluginCall){
  val handler=Handler(Looper.getMainLooper());handler.post {
   if(ContextCompat.checkSelfPermission(c,Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){call.reject("Allow location access in Android settings, or choose your city. Your saved location is unchanged.");return@post}
   val manager=c.getSystemService(Context.LOCATION_SERVICE) as LocationManager
   val fine=ContextCompat.checkSelfPermission(c,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
   val providers=listOf("fused",LocationManager.NETWORK_PROVIDER,LocationManager.GPS_PROVIDER).filter{(it!=LocationManager.GPS_PROVIDER||fine)&&runCatching{manager.isProviderEnabled(it)}.getOrDefault(false)}
   if(providers.isEmpty()){call.reject("Location is turned off. Turn on Location and try again, or choose your city. Your saved location is unchanged.");return@post}
   val finished=AtomicBoolean(false);val signals=mutableListOf<CancellationSignal>();val listeners=mutableListOf<LocationListener>()
   fun age(loc:Location)=((SystemClock.elapsedRealtimeNanos()-loc.elapsedRealtimeNanos)/1000000).coerceAtLeast(0)
   fun usable(loc:Location)=loc.hasAccuracy()&&LocationFixRules.usable(loc.latitude,loc.longitude,age(loc),loc.accuracy)
   fun cleanup(){for(signal in signals)signal.cancel();for(listener in listeners)runCatching{manager.removeUpdates(listener)}}
   fun resolve(loc:Location,cached:Boolean){if(finished.compareAndSet(false,true)){cleanup();call.resolve(JSObject().put("lat",loc.latitude).put("lng",loc.longitude).put("accuracy",loc.accuracy).put("cached",cached).put("ageMs",age(loc)))}}
   fun cached()=providers.mapNotNull{runCatching{manager.getLastKnownLocation(it)}.getOrNull()}.filter{usable(it)}.minByOrNull{age(it)}
   val recent=cached();if(recent!=null&&age(recent)<=120000){resolve(recent,true);return@post}
   for(provider in providers){
    val listener=object:LocationListener{override fun onLocationChanged(loc:Location){if(usable(loc))resolve(loc,false)};override fun onProviderEnabled(p:String){};override fun onProviderDisabled(p:String){};@Deprecated("Compatibility")override fun onStatusChanged(p:String?,s:Int,e:Bundle?){} }
    listeners.add(listener)
    runCatching{manager.requestLocationUpdates(provider,0L,0f,listener,Looper.getMainLooper())}
    if(Build.VERSION.SDK_INT>=30){val signal=CancellationSignal();signals.add(signal);runCatching{manager.getCurrentLocation(provider,signal,c.mainExecutor){loc->if(loc!=null&&usable(loc))resolve(loc,false)}}}
   }
   handler.postDelayed({if(!finished.get()){val last=cached();if(last!=null)resolve(last,true) else if(finished.compareAndSet(false,true)){cleanup();call.reject("Could not get a fresh location. Your saved city is still in use. Turn on Location and try again outdoors, or choose a city in Settings.")}}},25000)
  }
 }
}
