package org.salahguard.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureVault(private val context: Context, private val namespace: String = "session") {
  companion object {
    private val lock = Any()
  }

  fun set(value: String) = synchronized(lock) { setInternal(value) }

  fun get(): String = synchronized(lock) { getInternal() }

  fun destroy() =
    synchronized(lock) {
      setInternal("")
      val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      store.deleteEntry("salahguard.$namespace.v1")
    }

  fun rotate(expected: String, value: String): Boolean =
    synchronized(lock) {
      if (getInternal() != expected) false
      else {
        setInternal(value)
        true
      }
    }

  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = "salahguard.$namespace.v1"
    if (store.containsAlias(alias)) return store.getKey(alias, null) as SecretKey
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
      .apply {
        init(
          KeyGenParameterSpec.Builder(
              alias,
              KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build()
        )
      }
      .generateKey()
  }

  private fun setInternal(value: String) {
    val prefs = context.getSharedPreferences(namespace, Context.MODE_PRIVATE)
    if (value.isEmpty()) {
      prefs.edit().clear().commit()
      return
    }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val data = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    val encoded = Base64.encodeToString(cipher.iv + data, Base64.NO_WRAP)
    check(prefs.edit().putString("encrypted", encoded).commit())
  }

  private fun getInternal(): String {
    val encoded =
      context.getSharedPreferences(namespace, Context.MODE_PRIVATE).getString("encrypted", null)
        ?: return ""
    return try {
      val data = Base64.decode(encoded, Base64.NO_WRAP)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
      String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8)
    } catch (e: Exception) {
      if (namespace != "session")
        throw IllegalStateException("Encrypted secure storage could not be opened", e)
      setInternal("")
      ""
    }
  }
}
