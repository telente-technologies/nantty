package com.nantty.android.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Persistence boundary for safe, account-scoped clip interaction event JSON. */
interface ClipWatchPendingInteractionStore {
    fun read(accountId: String): List<JSONObject>
    fun write(accountId: String, events: List<JSONObject>)
}

internal class SharedPreferencesClipWatchPendingInteractionStore(context: Context) : ClipWatchPendingInteractionStore {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    override fun read(accountId: String): List<JSONObject> {
        val raw = preferences.getString(storageKey(accountId), null) ?: return emptyList()
        val events = decodeClipWatchInteractions(raw)
        if (events.isEmpty()) preferences.edit().remove(storageKey(accountId)).apply()
        else if (!isCanonicalClipWatchQueue(raw, events)) {
            write(accountId, events)
        }
        return events
    }

    @Synchronized
    override fun write(accountId: String, events: List<JSONObject>) {
        val safeEvents = events.asSequence()
            .mapNotNull(JSONObject::toSafeClipWatchInteraction)
            .toList()
            .takeLast(ClipWatchTrackingRepository.MAXIMUM_PENDING_KEPT)
        val key = storageKey(accountId)
        val editor = preferences.edit()
        if (safeEvents.isEmpty()) editor.remove(key)
        else editor.putString(key, JSONArray().apply { safeEvents.forEach { put(JSONObject(it.toString())) } }.toString())
        check(editor.commit()) { "Could not persist clip interaction queue." }
    }

    private fun storageKey(accountId: String): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(accountId.toByteArray(Charsets.UTF_8))
        return "$QUEUE_KEY_PREFIX${digest.joinToString("") { "%02x".format(it) }}"
    }

    companion object {
        private const val PREFERENCES_NAME = "nantty.clipWatchInteractions.v1"
        private const val QUEUE_KEY_PREFIX = "account."
    }
}

internal fun decodeClipWatchInteractions(raw: String): List<JSONObject> = runCatching {
    val array = JSONArray(raw)
    buildList {
        for (index in 0 until array.length()) {
            val event = array.optJSONObject(index) ?: continue
            event.toSafeClipWatchInteraction()?.let(::add)
        }
    }.takeLast(ClipWatchTrackingRepository.MAXIMUM_PENDING_KEPT)
}.getOrDefault(emptyList())

private fun isCanonicalClipWatchQueue(raw: String, events: List<JSONObject>): Boolean = runCatching {
    val stored = JSONArray(raw)
    if (stored.length() != events.size) return@runCatching false
    events.indices.all { index ->
        val previous = stored.optJSONObject(index) ?: return@all false
        val current = events[index]
        val keys = previous.keys().asSequence().toSet()
        keys == current.keys().asSequence().toSet() && keys.all { key ->
            val oldValue = previous.opt(key)
            val newValue = current.opt(key)
            if (oldValue is Number && newValue is Number) oldValue.toDouble() == newValue.toDouble()
            else oldValue == newValue
        }
    }
}.getOrDefault(false)

private fun JSONObject.toSafeClipWatchInteraction(): JSONObject? {
    val source = this
    val postId = optString("postId").takeIf(String::isNotBlank) ?: return null
    val kind = optString("kind").takeIf { it in setOf("view", "dwell", "watch") } ?: return null
    if (optString("surface") != "clips") return null
    return JSONObject().put("postId", postId).put("kind", kind).put("surface", "clips").apply {
        when (kind) {
            "view" -> if (source.has("position")) put("position", source.optInt("position").coerceIn(0, 10_000))
            "dwell" -> {
                if (source.has("dwellMs")) put("dwellMs", source.optLong("dwellMs").coerceIn(0L, 3_600_000L).toInt())
                if (source.has("position")) put("position", source.optInt("position").coerceIn(0, 10_000))
            }
            "watch" -> {
                if (source.has("watchMs")) put("watchMs", source.optLong("watchMs").coerceIn(0L, 3_600_000L).toInt())
                if (source.has("durationMs")) put("durationMs", source.optLong("durationMs").coerceIn(0L, 3_600_000L).toInt())
                if (source.has("watchFraction")) put("watchFraction", source.optDouble("watchFraction").coerceIn(0.0, 1.0))
                if (source.has("loopCount")) put("loopCount", source.optInt("loopCount").coerceIn(0, 100))
            }
        }
    }
}
