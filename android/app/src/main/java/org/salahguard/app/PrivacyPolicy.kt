package org.salahguard.app

/** Pure gate policy; biometric enablement still requires the platform authentication callback. */
object PrivacyPolicy {
 fun enabled(pin:Boolean,biometric:Boolean)=pin || biometric
 fun open(pin:Boolean,biometric:Boolean,sameScope:Boolean,now:Long,until:Long)=!enabled(pin,biometric) || (sameScope && now<until)
}
