package org.salahguard.app

import org.json.JSONArray
import org.json.JSONObject

/** Keyed three-way merge; a background acknowledgment cannot erase a new foreground operation. */
object SnapshotMerge {
  private object Missing

  private fun equal(a: Any?, b: Any?): Boolean {
    if (a === Missing || b === Missing) return a === b
    if (a is JSONObject && b is JSONObject) {
      val ak = a.keys().asSequence().toSet()
      return ak == b.keys().asSequence().toSet() && ak.all { equal(a.opt(it), b.opt(it)) }
    }
    if (a is JSONArray && b is JSONArray)
      return a.length() == b.length() && (0 until a.length()).all { equal(a.opt(it), b.opt(it)) }
    return a == b
  }

  private fun value(o: JSONObject?, key: String): Any? =
    if (o?.has(key) == true) o.opt(key) else Missing

  private fun merge(base: Any?, incoming: Any?, current: Any?, path: String): Any? {
    if (equal(incoming, base)) return current
    if (equal(current, base) || equal(incoming, current)) return incoming
    if (
      path in listOf("records", "queue", "localFiles") &&
        incoming is JSONArray &&
        current is JSONArray
    ) {
      fun keyed(a: Any?): Map<String, Any?> {
        if (a !is JSONArray) return emptyMap()
        return (0 until a.length()).associate {
          val item = a.getJSONObject(it)
          (if (path == "records") item.getString("entity") + ":" else "") + item.getString("id") to
            item
        }
      }
      val b = keyed(base)
      val i = keyed(incoming)
      val c = keyed(current)
      val out = JSONArray()
      (b.keys + c.keys + i.keys).forEach { key ->
        val v = merge(b[key] ?: Missing, i[key] ?: Missing, c[key] ?: Missing, "item")
        if (v !== Missing) out.put(v)
      }
      return out
    }
    if (incoming is JSONObject && current is JSONObject) {
      val b = base as? JSONObject
      val keys =
        (b?.keys()?.asSequence()?.toSet() ?: emptySet()) +
          current.keys().asSequence().toSet() +
          incoming.keys().asSequence().toSet()
      val out = JSONObject()
      keys.forEach { key ->
        val v = merge(value(b, key), value(incoming, key), value(current, key), key)
        if (v !== Missing) out.put(key, v)
      }
      return out
    }
    return incoming
  }

  fun combine(base: JSONObject, incoming: JSONObject, current: JSONObject): JSONObject =
    merge(base, incoming, current, "") as JSONObject
}
