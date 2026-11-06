package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ClipWatchTrackingRepositoryTest {
    private val session = AccountSession("token", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
    private lateinit var store: FakePendingStore

    @Before
    fun setUp() {
        store = FakePendingStore()
    }

    @Test
    fun sendsAuthenticatedClipViewDwellAndPlaybackSummaryToExistingBatchRoute() {
        val calls = mutableListOf<Call>()
        val repository = ClipWatchTrackingRepository(
            sessionProvider = { session },
            transport = ClipWatchInteractionTransport { path, token, body -> calls += Call(path, token, body); JSONObject() },
            pendingInteractionStore = store,
        )

        assertTrue(repository.record(clipSession()).isSuccess)

        val call = calls.single()
        assertEquals(ClipWatchTrackingRepository.BATCH_PATH, call.path)
        assertEquals("token", call.token)
        val events = call.body.getJSONArray("events")
        assertEquals(listOf("view", "dwell", "watch"), events.kinds())
        assertEquals("clips", events.getJSONObject(0).getString("surface"))
        assertEquals(2_400, events.getJSONObject(1).getInt("dwellMs"))
        assertEquals(4_500, events.getJSONObject(2).getInt("watchMs"))
        assertEquals(12_000, events.getJSONObject(2).getInt("durationMs"))
        assertEquals(0.75, events.getJSONObject(2).getDouble("watchFraction"), 0.0001)
        assertEquals(1, events.getJSONObject(2).getInt("loopCount"))
    }

    @Test
    fun onlyRecordsOneViewPerClipForTheSignedInSession() {
        val batches = mutableListOf<JSONArray>()
        val repository = ClipWatchTrackingRepository(
            sessionProvider = { session },
            transport = ClipWatchInteractionTransport { _, _, body -> batches += body.getJSONArray("events"); JSONObject() },
            pendingInteractionStore = store,
        )

        repository.record(clipSession()).getOrThrow()
        repository.record(clipSession(visibleMs = 2_100)).getOrThrow()

        assertEquals(listOf("view", "dwell", "watch"), batches[0].kinds())
        assertEquals(listOf("dwell", "watch"), batches[1].kinds())
    }

    @Test
    fun requiresSignedInSessionAndSkipsAuthorAndActingProfileOwnedClips() {
        var sends = 0
        val transport = ClipWatchInteractionTransport { _, _, _ -> sends += 1; JSONObject() }
        assertFalse(ClipWatchTrackingRepository({ null }, transport = transport, pendingInteractionStore = store).record(clipSession()).isSuccess)
        assertTrue(ClipWatchTrackingRepository({ session }, transport = transport, pendingInteractionStore = store).record(clipSession(authorId = "viewer")).isSuccess)
        assertTrue(ClipWatchTrackingRepository(
            sessionProvider = { session },
            actingProfileIdProvider = { "profile-1" },
            transport = transport,
            pendingInteractionStore = store,
        ).record(clipSession(postedAsId = "profile-1")).isSuccess)
        assertEquals(0, sends)
    }

    @Test
    fun clipsBelowVisibleThresholdAreNotSent() {
        var sends = 0
        val repository = ClipWatchTrackingRepository(
            sessionProvider = { session },
            transport = ClipWatchInteractionTransport { _, _, _ -> sends += 1; JSONObject() },
            pendingInteractionStore = store,
        )

        assertFalse(repository.record(clipSession(visibleMs = 1_999)).isSuccess)
        assertEquals(0, sends)
    }

    @Test
    fun malformedPersistedJsonIsDiscardedWithoutBreakingNewEvents() {
        assertTrue(decodeClipWatchInteractions("{not-json").isEmpty())
        val sanitized = decodeClipWatchInteractions("[null, 4, {\"accessToken\":\"secret\",\"postId\":\"clip\",\"kind\":\"view\",\"surface\":\"clips\"}]").single()
        assertFalse(sanitized.has("accessToken"))
        store.seedRaw("viewer", "{not-json")
        val repository = ClipWatchTrackingRepository(
            { session },
            transport = ClipWatchInteractionTransport { _, _, _ -> JSONObject() },
            pendingInteractionStore = store,
        )

        assertTrue(repository.record(clipSession()).isSuccess)
        assertTrue(store.read("viewer").isEmpty())
    }

    @Test
    fun migrationSanitizationKeepsOnlyAllowedInteractionFields() {
        val migrated = decodeClipWatchInteractions(
            """[{"postId":"clip-1","kind":"watch","surface":"clips","watchMs":1200,"durationMs":5000,"watchFraction":0.24,"loopCount":2,"accountId":"viewer","accessToken":"secret"}]""",
        ).single()

        assertEquals("sanitized=${migrated}", setOf("postId", "kind", "surface", "watchMs", "durationMs", "watchFraction", "loopCount"), migrated.keys().asSequence().toSet())
        assertFalse(migrated.has("accountId"))
        assertFalse(migrated.has("accessToken"))
    }

    @Test
    fun failedBatchRemainsQueuedForTheNextAuthenticatedFlush() {
        var shouldFail = true
        val batches = mutableListOf<JSONArray>()
        val repository = ClipWatchTrackingRepository(
            sessionProvider = { session },
            transport = ClipWatchInteractionTransport { _, _, body ->
                batches += body.getJSONArray("events")
                if (shouldFail) error("offline")
                JSONObject()
            },
            pendingInteractionStore = store,
        )

        assertFalse(repository.record(clipSession()).isSuccess)
        shouldFail = false
        repository.record(clipSession(visibleMs = 2_100)).getOrThrow()

        assertEquals(listOf("view", "dwell", "watch"), batches.first().kinds())
        assertEquals(listOf("view", "dwell", "watch", "dwell", "watch"), batches.last().kinds())
    }

    @Test
    fun failedBatchSurvivesRepositoryRecreationAndOnlyClearsAfterSuccess() {
        var shouldFail = true
        val batches = mutableListOf<List<String>>()
        val transport = ClipWatchInteractionTransport { _, _, body ->
            batches += body.getJSONArray("events").kinds()
            if (shouldFail) error("offline")
            JSONObject()
        }
        val firstLaunch = ClipWatchTrackingRepository({ session }, transport = transport, pendingInteractionStore = store)

        assertFalse(firstLaunch.record(clipSession()).isSuccess)
        assertEquals(3, store.read("viewer").size)
        assertTrue(store.read("viewer").none { it.has("accessToken") || it.has("refreshToken") })

        shouldFail = false
        val nextLaunch = ClipWatchTrackingRepository({ session }, transport = transport, pendingInteractionStore = store)
        nextLaunch.record(clipSession(postId = "clip-2")).getOrThrow()

        assertEquals(listOf("view", "dwell", "watch"), batches.last().take(3))
        assertTrue(store.read("viewer").isEmpty())
    }

    @Test
    fun pendingEventsAreIsolatedByAccount() {
        val accountA = session
        val accountB = session.copy(user = session.user.copy(id = "another-viewer"))
        val failingTransport = ClipWatchInteractionTransport { _, _, _ -> error("offline") }

        ClipWatchTrackingRepository({ accountA }, transport = failingTransport, pendingInteractionStore = store)
            .record(clipSession()).also { assertFalse(it.isSuccess) }
        ClipWatchTrackingRepository({ accountB }, transport = failingTransport, pendingInteractionStore = store)
            .record(clipSession(postId = "clip-2")).also { assertFalse(it.isSuccess) }

        assertEquals(listOf("clip-1"), store.read("viewer").map { it.getString("postId") }.distinct())
        assertEquals(listOf("clip-2"), store.read("another-viewer").map { it.getString("postId") }.distinct())
    }

    @Test
    fun capsPendingQueueAndSendsInBatchesOfFifty() {
        store.write("viewer", (1..ClipWatchTrackingRepository.MAXIMUM_PENDING_KEPT).map { event("prior-$it", "view") })
        val batchSizes = mutableListOf<Int>()
        val repository = ClipWatchTrackingRepository(
            { session },
            transport = ClipWatchInteractionTransport { _, _, body -> batchSizes += body.getJSONArray("events").length(); JSONObject() },
            pendingInteractionStore = store,
        )

        repository.record(clipSession()).getOrThrow()

        assertEquals(List(10) { 50 }, batchSizes)
        assertTrue(store.read("viewer").isEmpty())
    }

    @Test
    fun parsesPostedAsOwnerIdFromTheExistingClipFeedPayload() {
        val page = ClipsRepository().parsePage(JSONObject("""{"data":[{"id":"clip-1","kind":"clip","author":{"id":"creator"},"postedAs":{"id":"brand-owner"},"durationSeconds":12,"media":[]}] }"""))
            .items.single()
        assertEquals("brand-owner", page.post.postedAsId)
    }

    private fun clipSession(
        postId: String = "clip-1",
        visibleMs: Long = 2_400,
        authorId: String = "creator",
        postedAsId: String? = null,
    ) = ClipWatchInteractionSession(
        postId = postId,
        authorId = authorId,
        postedAsId = postedAsId,
        visibleMs = visibleMs,
        watch = ClipWatchSummary(4_500, 12_000, 0.75, 1),
    )

    private fun JSONArray.kinds(): List<String> = (0 until length()).map { getJSONObject(it).getString("kind") }

    private fun event(postId: String, kind: String) = JSONObject().put("postId", postId).put("kind", kind).put("surface", "clips")

    private class FakePendingStore : ClipWatchPendingInteractionStore {
        private val queues = mutableMapOf<String, List<JSONObject>>()
        private val rawValues = mutableMapOf<String, String>()
        override fun read(accountId: String): List<JSONObject> {
            rawValues.remove(accountId)?.let { return decodeClipWatchInteractions(it) }
            return queues[accountId].orEmpty().map { JSONObject(it.toString()) }
        }
        override fun write(accountId: String, events: List<JSONObject>) {
            rawValues.remove(accountId)
            if (events.isEmpty()) queues.remove(accountId) else queues[accountId] = events.map { JSONObject(it.toString()) }
        }
        fun seedRaw(accountId: String, raw: String) { rawValues[accountId] = raw }
    }

    private data class Call(val path: String, val token: String, val body: JSONObject)
}
