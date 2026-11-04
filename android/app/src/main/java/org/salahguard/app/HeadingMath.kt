package org.salahguard.app
/** Pure sensor mathematics, independently testable from hardware accuracy. */
object HeadingMath {
 fun trueNorth(magneticDegrees:Double,declination:Double):Double = ((magneticDegrees+declination)%360+360)%360
 fun axes(rotation:Int):Pair<Int,Int> = when(rotation) { 1->2 to 129; 2->129 to 130; 3->130 to 1; else->1 to 2 }
}
