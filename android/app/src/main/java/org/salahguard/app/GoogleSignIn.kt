package org.salahguard.app
import android.app.Activity
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.credentials.*
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.getcapacitor.PluginCall
import com.getcapacitor.JSObject
object GoogleSignIn {
 fun begin(activity:Activity,call:PluginCall){
  val client=call.getString("clientId")?:"";val nonce=call.getString("nonce")?:""
  if(!client.endsWith(".apps.googleusercontent.com")||!Regex("[a-f0-9]{64}").matches(nonce)){call.reject("Google sign-in is not configured");return}
  activity.runOnUiThread{
   val option=GetSignInWithGoogleOption.Builder(client).setNonce(nonce).build()
   val request=GetCredentialRequest.Builder().addCredentialOption(option).build()
   CredentialManager.create(activity).getCredentialAsync(activity,request,CancellationSignal(),ContextCompat.getMainExecutor(activity),object:CredentialManagerCallback<GetCredentialResponse,GetCredentialException>{
    override fun onResult(result:GetCredentialResponse){
     try{val credential=result.credential
      require(credential is CustomCredential&&credential.type==GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
      call.resolve(JSObject().put("idToken",GoogleIdTokenCredential.createFrom(credential.data).idToken))
     }catch(error:Exception){call.reject("Google sign-in did not return a supported identity")}
    }
    override fun onError(error:GetCredentialException){call.reject("Google sign-in was canceled or is unavailable. You can continue as a guest.")}
   })
  }
 }
}
