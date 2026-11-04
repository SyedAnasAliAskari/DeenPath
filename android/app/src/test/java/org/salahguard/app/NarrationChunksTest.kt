package org.salahguard.app
import org.junit.Assert.*
import org.junit.Test
class NarrationChunksTest {
 @Test fun preservesArabicAndUrduWithoutReadingControls(){val text="First sentence. لَا إِلَٰهَ إِلَّا أَنتَ۔ Next sentence.";val chunks=NarrationChunks.split(text,"en");assertTrue(chunks.joinToString(" ").contains("لَا إِلَٰهَ إِلَّا أَنتَ"));assertTrue(chunks.all{it.isNotBlank()})}
 @Test fun boundsLongParagraphsWithoutSplittingSurrogatePairs(){val text="word ".repeat(2000)+"😀";val chunks=NarrationChunks.split(text,"ur",100);assertTrue(chunks.size>20);assertTrue(chunks.all{it.length<=100});assertTrue(chunks.last().endsWith("😀"))}
}
