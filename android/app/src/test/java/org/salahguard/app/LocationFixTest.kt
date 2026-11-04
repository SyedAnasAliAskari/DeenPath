package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
class LocationFixTest {
 @Test fun recentApproximateAndPreciseFixesAreUsable(){assertTrue(LocationFixRules.usable(24.86,67.0,120000,2000f));assertTrue(LocationFixRules.usable(24.86,67.0,0,10f))}
 @Test fun staleInvalidAndUnboundedFixesAreRejected(){assertFalse(LocationFixRules.usable(24.86,67.0,900001,20f));assertFalse(LocationFixRules.usable(Double.NaN,67.0,0,20f));assertFalse(LocationFixRules.usable(91.0,67.0,0,20f));assertFalse(LocationFixRules.usable(24.86,67.0,0,20000f))}
}
