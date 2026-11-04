package org.salahguard.app
import java.text.BreakIterator
import java.util.Locale
/** Bounded sentences let every engine resume safely without seeking audio. */
object NarrationChunks {
 fun split(text:String,language:String,limit:Int=3000):List<String>{
  require(language in listOf("en","ur"));require(limit in 100..3900)
  val boundary=BreakIterator.getSentenceInstance(Locale.forLanguageTag(language));boundary.setText(text)
  val result=mutableListOf<String>();var start=boundary.first();var end=boundary.next()
  while(end!=BreakIterator.DONE){var sentence=text.substring(start,end).trim();while(sentence.length>limit){var cut=sentence.lastIndexOf(' ',limit);if(cut<limit/2)cut=limit;if(Character.isHighSurrogate(sentence[cut-1]))cut--;result.add(sentence.substring(0,cut).trim());sentence=sentence.substring(cut).trim()};if(sentence.isNotBlank())result.add(sentence);start=end;end=boundary.next()}
  return result
 }
}
