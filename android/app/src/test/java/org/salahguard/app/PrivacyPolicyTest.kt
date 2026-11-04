package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
class PrivacyPolicyTest {
 @Test fun biometricOnlyGateCannotOpenWithoutValidAuthentication() { assertTrue(PrivacyPolicy.enabled(false,true)); assertFalse(PrivacyPolicy.open(false,true,true,100,0)); assertTrue(PrivacyPolicy.open(false,true,true,100,200)) }
 @Test fun authenticatedSessionCannotCrossAccountsOrOutliveTimeout() { assertFalse(PrivacyPolicy.open(true,true,false,100,200)); assertFalse(PrivacyPolicy.open(false,true,true,200,200)); assertTrue(PrivacyPolicy.open(false,false,false,100,0)) }
}
