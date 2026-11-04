package org.salahguard.app
import org.json.JSONObject
object CompletionRewards {
 fun earned(before:JSONObject?,after:JSONObject?,prefix:String):Int {
  if(prefix.isBlank())return 0
  val claims=after?.optJSONObject("claims")?:return 0
  return claims.keys().asSequence().filter{it==prefix||it.startsWith("$prefix:")}.sumOf{key->val old=before?.optJSONObject("claims")?.optJSONObject(key);val next=claims.getJSONObject(key);((if(next.optBoolean("active"))next.optInt("amount")else 0)-(if(old?.optBoolean("active")==true)old.optInt("amount")else 0)).coerceAtLeast(0)}
 }
 fun receipt(label:String,earned:Int)=label+" Completed ✓"+(if(earned>0)" +$earned Gems"else "")
}
