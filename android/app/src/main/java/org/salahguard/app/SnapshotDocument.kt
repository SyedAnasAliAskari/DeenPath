package org.salahguard.app

import org.json.JSONObject

/** A new SQLite installation has no snapshot yet. Blank is not corrupt JSON. */
object SnapshotDocument {
  fun parse(raw: String): JSONObject = if (raw.isBlank()) JSONObject() else JSONObject(raw)

  fun owner(raw: String): String =
    parse(raw).optString("owner", "local").let { if (it.isBlank() || it == "null") "local" else it }
}
