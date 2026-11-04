package org.salahguard.app
object MultipartBody {
  data class Parts(val prefix: ByteArray, val suffix: ByteArray)

  fun parts(id: String, filename: String, mime: String, profile: Boolean, boundary: String): Parts {
    val name = filename.replace("\"", "_").replace("\r", "_").replace("\n", "_").replace("\\", "_")
    val prefix = buildString {
      append("--$boundary\r\nContent-Disposition: form-data; name=\"id\"\r\n\r\n$id\r\n")
      if (profile)
        append("--$boundary\r\nContent-Disposition: form-data; name=\"profile\"\r\n\r\n1\r\n")
      append(
        "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"$name\"\r\nContent-Type: $mime\r\n\r\n"
      )
    }
      .toByteArray(Charsets.UTF_8)
    return Parts(prefix, "\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8))
  }
}
