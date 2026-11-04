package org.salahguard.app
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSObject
import java.util.Locale

/** Foreground, device-engine narration. No audio files, server calls or silent voice installation. */
class StoryNarrator(private val activity:Activity,private val emit:(JSObject)->Unit) {
 private val main=Handler(Looper.getMainLooper())
 private val audio=activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
 private var engine:TextToSpeech?=null
 private var ready=false;private var initializing=false;private var initEpoch=0
 private var story="";private var language="en";private var text="";private var sentences=emptyList<String>();private var position=0
 private var networkVoice=false;private var engineStarted=false;private var speed=1f;private var state="stopped";private var generation=0;private var installing=false
 private val attributes=AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
 private val focus=AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes).setOnAudioFocusChangeListener{change->if(change<0)main.post{pause()}}.build()
 private fun status(message:String="")=JSObject().put("state",state).put("storyId",story).put("language",language).put("sentence",position).put("total",sentences.size).put("message",if(message.isNotBlank())message else if(networkVoice)"This installed Android voice uses the internet. Choose an offline voice in Android settings for offline listening." else "").put("networkVoice",networkVoice).put("engineStarted",engineStarted)
 private fun publish(message:String=""){emit(status(message))}
 private fun initialize(){
  if(ready||initializing)return
  initializing=true;val epoch=++initEpoch
  engine=TextToSpeech(activity.applicationContext){code->main.post{
   if(epoch!=initEpoch)return@post
   initializing=false;ready=code==TextToSpeech.SUCCESS
   if(!ready){state="error";publish("Your text-to-speech engine could not start. Check Android speech settings.")}
   else{engine?.setAudioAttributes(attributes);engine?.setOnUtteranceProgressListener(object:UtteranceProgressListener(){
    override fun onStart(id:String?){main.post{if(id=="$generation:$position"&&state=="playing"){engineStarted=true;publish()}}}
    override fun onDone(id:String?){main.post{if(id=="$generation:$position"&&state=="playing"){position++;if(position>=sentences.size){state="stopped";position=0;audio.abandonAudioFocusRequest(focus);publish()}else speak()}}}
    @Deprecated("Legacy TTS callback") override fun onError(id:String?){main.post{if(id=="$generation:$position"){state="error";audio.abandonAudioFocusRequest(focus);publish("Narration was interrupted by the speech engine. Try again or choose another Android voice.")}}}
   });if(state=="loading")play()else publish()}
  }}
 }
 private fun voiceAvailable():Boolean{
  val tts=engine?:return false;val locale=Locale.forLanguageTag(if(language=="ur")"ur-PK" else "en")
  val support=tts.isLanguageAvailable(locale)
  if(support<0)return false
  // Prefer installed offline voices. Existing network voices remain usable; voice installation is always explicit.
  val voice=tts.voices?.filter{it.locale.language==language&&!it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)}?.sortedWith(compareBy<android.speech.tts.Voice>{it.isNetworkConnectionRequired}.thenBy{it.name})?.firstOrNull()?:return false
  networkVoice=voice.isNetworkConnectionRequired
  return tts.setVoice(voice)==TextToSpeech.SUCCESS
 }
 fun command(action:String,id:String="",lang:String="en",content:String="",rate:Float=1f):JSObject{
  when(action){
   "play"->{require(lang in listOf("en","ur"));require(content.length<=120000);require(rate in listOf(.75f,1f,1.25f,1.5f));if(id!=story||lang!=language||content!=text){stop();story=id;language=lang;text=content;sentences=NarrationChunks.split(content,lang);position=0};speed=rate;play()}
   "pause"->pause()
   "stop"->stop()
   "install"->{require(story.isNotBlank());installing=true;pause();state="installing";publish();val install=Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).setPackage(engine?.defaultEngine);try{activity.startActivity(install)}catch(_:Exception){try{activity.startActivity(Intent("com.android.settings.TTS_SETTINGS"))}catch(_:Exception){installing=false;state="error";publish("Open Android Settings, then Text-to-speech output, and choose an engine with an installed Urdu voice.")}}}
   "release"->release()
   "status"->publish()
   else->throw IllegalArgumentException("Unknown narration action")
  };return status()
 }
 private fun play(){
  if(sentences.isEmpty()){state="error";publish("This story is not available in the selected language.");return}
  if(!ready){state="loading";publish();initialize();return}
  if(!voiceAvailable()){state="missing";publish(if(language=="ur")"This Android engine needs an installed Urdu voice. Some engines do not support Urdu." else "Install an English voice in Android text-to-speech settings.");return}
  if(audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){state="paused";publish("Another app is using audio. Try again when it finishes.");return}
  engineStarted=false;engine?.setSpeechRate(speed);generation++;engine?.stop();state="playing";publish();speak()
 }
 private fun speak(){
  if(position !in sentences.indices)return
  val content:CharSequence=if(language=="en")android.text.SpannableString(sentences[position]).apply{Regex("[\\u0600-\\u06ff\\u0750-\\u077f\\u08a0-\\u08ff]+(?:[ \\u064b-\\u065f]*[\\u0600-\\u06ff]+)*").findAll(sentences[position]).forEach{match->setSpan(android.text.style.LocaleSpan(Locale.forLanguageTag("ar")),match.range.first,match.range.last+1,android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)}}else sentences[position]
  val code=engine?.speak(content,TextToSpeech.QUEUE_FLUSH,null,"$generation:$position")
  if(code!=TextToSpeech.SUCCESS){state="error";audio.abandonAudioFocusRequest(focus);publish("The Android speech engine could not read this sentence.")}
 }
 fun pause(){if(state in listOf("playing","loading")){generation++;engine?.stop();state="paused";audio.abandonAudioFocusRequest(focus);publish()}}
 private fun stop(){engineStarted=false;generation++;engine?.stop();position=0;state="stopped";audio.abandonAudioFocusRequest(focus);publish()}
 fun resumed(){if(installing){installing=false;generation++;engine?.shutdown();engine=null;ready=false;initializing=false;state="loading";initialize()}}
 fun release(){initEpoch++;stop();story="";text="";sentences=emptyList();installing=false;engine?.shutdown();engine=null;ready=false;initializing=false}
}
