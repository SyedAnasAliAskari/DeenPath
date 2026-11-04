package org.salahguard.app

import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object PrivateCrypto {
  fun seal(key: ByteArray, text: String): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
    return Base64.getEncoder()
      .encodeToString(cipher.iv + cipher.doFinal(text.toByteArray(Charsets.UTF_8)))
  }

  fun open(key: ByteArray, text: String): String {
    val raw = Base64.getDecoder().decode(text)
    require(raw.size >= 28)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(
      Cipher.DECRYPT_MODE,
      SecretKeySpec(key, "AES"),
      GCMParameterSpec(128, raw.copyOfRange(0, 12)),
    )
    return String(cipher.doFinal(raw.copyOfRange(12, raw.size)), Charsets.UTF_8)
  }
}
