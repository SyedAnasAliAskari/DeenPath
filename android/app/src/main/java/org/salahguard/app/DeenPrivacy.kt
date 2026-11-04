package org.salahguard.app

import android.content.Context
import android.os.SystemClock
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

/**
 * A UI/privacy gate is separate from AES-GCM ciphertext encryption and Android Keystore wrapping.
 */
object DeenPrivacy {
  private var unlockedUntil = 0L
  private var unlockedScope = ""

  private fun scope(c: Context): String = LocalDatabase(c).use { SnapshotDocument.owner(it.load()) }

  private fun vault(c: Context) = SecureVault(c, "deen.private." + scope(c))

  @Synchronized
  private fun config(c: Context): JSONObject {
    val raw = vault(c).get()
    if (raw.isNotEmpty()) return JSONObject(raw)
    val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
    return JSONObject().put("key", Base64.encodeToString(key, Base64.NO_WRAP)).also {
      vault(c).set(it.toString())
    }
  }

  fun adopt(c: Context, newOwner: String) {
    if (scope(c) != "local" || newOwner.isBlank() || newOwner == "null") return
    val source = SecureVault(c, "deen.private.local")
    val target = SecureVault(c, "deen.private.$newOwner")
    if (source.get().isNotEmpty() && target.get().isEmpty()) target.set(source.get())
    val provider = SecureVault(c, "deen.providers.local")
    val providerTarget = SecureVault(c, "deen.providers.$newOwner")
    if (provider.get().isNotEmpty() && providerTarget.get().isEmpty())
      providerTarget.set(provider.get())
    val chat = SecureVault(c, "deen.chats.local")
    val chatTarget = SecureVault(c, "deen.chats.$newOwner")
    if (chat.get().isNotEmpty() && chatTarget.get().isEmpty()) chatTarget.set(chat.get())
    lock()
  }

  fun finishAdopt(c: Context) {
    if (scope(c) == "local") return
    val guest = SecureVault(c, "deen.private.local")
    val raw = guest.get()
    if (raw.isNotEmpty() && JSONObject(raw).optString("key") == config(c).optString("key")) {
      guest.destroy()
      SecureVault(c, "deen.providers.local").destroy()
      SecureVault(c, "deen.chats.local").destroy()
    }
  }

  fun erase(c: Context) {
    vault(c).destroy()
    SecureVault(c, "deen.providers." + scope(c)).destroy()
    SecureVault(c, "deen.chats." + scope(c)).destroy()
    lock()
  }

  fun status(c: Context): JSONObject =
    JSONObject()
      .put("enabled", PrivacyPolicy.enabled(config(c).has("pinHash"),config(c).optBoolean("biometricLock")))
      .put("pinEnabled",config(c).has("pinHash"))
      .put("biometricEnabled",config(c).optBoolean("biometricLock"))
      .put("unlocked", PrivacyPolicy.open(config(c).has("pinHash"),config(c).optBoolean("biometricLock"),unlockedScope==scope(c),SystemClock.elapsedRealtime(),unlockedUntil))

  private fun unlocked(c: Context) =
    unlockedScope == scope(c) && SystemClock.elapsedRealtime() < unlockedUntil

  @Synchronized
  fun lock() {
    unlockedUntil = 0
    unlockedScope = ""
  }

  @Synchronized
  fun allow(c: Context) {
    unlockedScope = scope(c)
    unlockedUntil = SystemClock.elapsedRealtime() + 600000
  }

  private fun ensureUnlocked(c: Context) {
    require(PrivacyPolicy.open(config(c).has("pinHash"),config(c).optBoolean("biometricLock"),unlockedScope==scope(c),SystemClock.elapsedRealtime(),unlockedUntil)) { "Protection is locked" }
  }

  private fun hash(pin: String, salt: ByteArray): ByteArray =
    SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      .generateSecret(PBEKeySpec(pin.toCharArray(), salt, 210000, 256))
      .encoded

  @Synchronized
  fun unlock(c: Context, pin: String) {
    val config = config(c)
    val prefs = c.getSharedPreferences("deen.pin.attempts", Context.MODE_PRIVATE)
    val key = scope(c)
    require(System.currentTimeMillis() >= prefs.getLong(key, 0)) { "Wait before retrying your PIN" }
    require(config.has("pinHash")) { "Use biometrics to unlock this private space" }
    val salt = Base64.decode(config.getString("salt"), Base64.NO_WRAP)
    val valid =
      MessageDigest.isEqual(
        hash(pin, salt),
        Base64.decode(config.getString("pinHash"), Base64.NO_WRAP),
      )
    if (!valid) {
      check(prefs.edit().putLong(key, System.currentTimeMillis() + 30000).commit())
      throw IllegalArgumentException("Incorrect PIN. Retry after 30 seconds.")
    }
    allow(c)
  }

  @Synchronized
  fun setPin(c: Context, pin: String) {
    ensureUnlocked(c)
    val v = config(c)
    if (pin.isEmpty()) {
      v.remove("pinHash")
      v.remove("salt")
    } else {
      require(pin.matches(Regex("[0-9]{6,12}"))) { "Use a PIN of 6 to 12 digits" }
      val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
      v.put("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
        .put("pinHash", Base64.encodeToString(hash(pin, salt), Base64.NO_WRAP))
    }
    vault(c).set(v.toString())
    allow(c)
  }

  @Synchronized
  fun setBiometric(c:Context, enabled:Boolean) {
    ensureUnlocked(c)
    val value=config(c).put("biometricLock",enabled)
    vault(c).set(value.toString())
    allow(c)
  }

  fun seal(c: Context, value: String): String {
    ensureUnlocked(c)
    require(value.length <= 30000)
    return PrivateCrypto.seal(Base64.decode(config(c).getString("key"), Base64.NO_WRAP), value)
  }

  fun open(c: Context, value: String): String {
    ensureUnlocked(c)
    return PrivateCrypto.open(Base64.decode(config(c).getString("key"), Base64.NO_WRAP), value)
  }

  fun backup(c: Context, password: String): String {
    ensureUnlocked(c)
    require(password.length >= 12) { "Use at least 12 characters for the recovery password" }
    val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(hash(password, salt), "AES"))
    return Base64.encodeToString(
      salt + cipher.iv + cipher.doFinal(config(c).getString("key").toByteArray(Charsets.UTF_8)),
      Base64.NO_WRAP,
    )
  }

  fun restore(c: Context, password: String, value: String) {
    ensureUnlocked(c)
    val bytes = Base64.decode(value, Base64.NO_WRAP)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(
      Cipher.DECRYPT_MODE,
      SecretKeySpec(hash(password, bytes.copyOfRange(0, 16)), "AES"),
      GCMParameterSpec(128, bytes.copyOfRange(16, 28)),
    )
    val key = String(cipher.doFinal(bytes.copyOfRange(28, bytes.size)), Charsets.UTF_8)
    require(Base64.decode(key, Base64.NO_WRAP).size == 32)
    vault(c).set(config(c).put("key", key).toString())
  }
}
