package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class ClipWatchSummary(
    val watchMs: Int,
    val durationMs: Int,
    val watchFraction: Double,
    val loopCount: Int,
)

data class ClipWatchInteractionSession(
    val postId: String,
    val authorId: String,
    val postedAsId: String?,
    val visibleMs: Long,
    val watch: ClipWatchSummary,
)

fun interface ClipWatchInteractionTransport {
    fun post(path: String, accessToken: String, body: JSONObject): JSONObject
}

/** Sends the same authenticated batch interaction contract used by the feed and Clips in RN. */
class ClipWatchTrackingRepository(
    private val sessionProvider: () -> AccountSession?,
    private val actingProfileIdProvider: () -> String? = { null },
    private val transport: ClipWatchInteractionTransport = JdkClipWatchInteractionTransport(BuildConfig.NANTTY_API_BASE_URL),
    private val pendingInteractionStore: ClipWatchPendingInteractionStore = InMemoryClipWatchPendingInteractionStore(),
) {
    private val viewedPostIdsByAccount = mutableMapOf<String, MutableSet<String>>()

    @Synchronized
    fun record(session: ClipWatchInteractionSession): Result<Unit> = runCatching {
        require(session.postId.isNotBlank() && session.authorId.isNotBlank()) { "Clip interaction target is invalid." }
        require(session.visibleMs >= MINIMUM_VISIBLE_MS) { "Clip was visible for less than the view threshold." }
        val account = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to record clip interactions.")
        val actingProfileId = actingProfileIdProvider()
        if (session.authorId == account.user.id || session.postedAsId == account.user.id ||
            (!actingProfileId.isNullOrBlank() && session.postedAsId == actingProfileId)
        ) return@runCatching

        val newEvents = mutableListOf<JSONObject>()
        val viewed = viewedPostIdsByAccount.getOrPut(account.user.id) { mutableSetOf() }
        if (viewed.add(session.postId)) {
            newEvents += JSONObject().put("postId", session.postId).put("kind", "view").put("surface", "clips")
        }
        if (session.visibleMs > 0) {
            newEvents += JSONObject().put("postId", session.postId).put("kind", "dwell").put("surface", "clips")
                .put("dwellMs", session.visibleMs.coerceAtMost(MAXIMUM_MILLISECONDS).toInt())
        }
        if (session.watch.watchMs > 0) {
            newEvents += JSONObject().put("postId", session.postId).put("kind", "watch").put("surface", "clips")
                .put("watchMs", session.watch.watchMs.coerceIn(0, MAXIMUM_MILLISECONDS.toInt()))
                .put("durationMs", session.watch.durationMs.coerceIn(0, MAXIMUM_MILLISECONDS.toInt()))
                .put("watchFraction", session.watch.watchFraction.coerceIn(0.0, 1.0))
                .put("loopCount", session.watch.loopCount.coerceIn(0, MAXIMUM_LOOPS))
        }
        var pending = pendingInteractionStore.read(account.user.id).toMutableList()
        pending += newEvents
        pending = pending.takeLast(MAXIMUM_PENDING_KEPT).toMutableList()
        pendingInteractionStore.write(account.user.id, pending)
        if (pending.isNotEmpty()) {
            while (pending.isNotEmpty()) {
                val batchEvents = pending.take(MAXIMUM_INTERACTIONS_PER_BATCH)
                val batch = JSONArray().apply { batchEvents.forEach { put(JSONObject(it.toString())) } }
                transport.post(BATCH_PATH, account.accessToken, JSONObject().put("events", batch))
                pending = pending.drop(batchEvents.size).toMutableList()
                pendingInteractionStore.write(account.user.id, pending)
            }
        }
        Unit
    }

    companion object {
        const val BATCH_PATH = "/api/v1/feeds/interactions/batch"
        const val MINIMUM_VISIBLE_MS = 2_000L
        const val MAXIMUM_PENDING_KEPT = 500
        const val MAXIMUM_INTERACTIONS_PER_BATCH = 50
        private const val MAXIMUM_MILLISECONDS = 3_600_000L
        private const val MAXIMUM_LOOPS = 100
    }
}

class InMemoryClipWatchPendingInteractionStore : ClipWatchPendingInteractionStore {
    private val eventsByAccount = mutableMapOf<String, List<JSONObject>>()

    @Synchronized
    override fun read(accountId: String): List<JSONObject> = eventsByAccount[accountId].orEmpty().map { JSONObject(it.toString()) }

    @Synchronized
    override fun write(accountId: String, events: List<JSONObject>) {
        if (events.isEmpty()) eventsByAccount.remove(accountId)
        else eventsByAccount[accountId] = events.takeLast(ClipWatchTrackingRepository.MAXIMUM_PENDING_KEPT).map { JSONObject(it.toString()) }
    }
}

private class JdkClipWatchInteractionTransport(private val baseUrl: String) : ClipWatchInteractionTransport {
    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
        require(path == ClipWatchTrackingRepository.BATCH_PATH && accessToken.isNotBlank()) { "Unsupported clip interaction request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to record clip interactions.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            doOutput = true
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) error("Clip interaction request failed (HTTP $status).")
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}
