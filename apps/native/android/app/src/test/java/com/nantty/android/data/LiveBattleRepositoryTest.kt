package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveBattleRepositoryTest {
    @Test
    fun contributionPostsExactContractWithBearerAndIdempotencyAndParsesUpdatedStage() {
        val transport = RecordingLiveBattleTransport(stagePayload())
        val repository = LiveBattleRepository(
            baseUrl = "https://api.nantty.test",
            accessTokenProvider = { "  access-token  " },
            transport = transport,
        )

        val result = repository.contributeCoins(
            battleId = "battle_123",
            contribution = LiveBattleCoinContribution(recipientUserId = "viewer-456", coins = 250),
            idempotencyKey = "request-key-123",
        )

        val call = transport.calls.single()
        assertEquals("/api/v1/battles/battle_123/coins", call.path)
        assertEquals("access-token", call.accessToken)
        assertEquals("request-key-123", call.idempotencyKey)
        assertEquals(setOf("recipientUserId", "coins"), call.body.keys().asSequence().toSet())
        assertEquals("viewer-456", call.body.getString("recipientUserId"))
        assertEquals(250L, call.body.getLong("coins"))

        val stage = (result as LiveBattleContributionResult.Success).stage
        assertEquals("live-001", stage.liveId)
        assertEquals("battle", stage.layout)
        assertEquals("battling", stage.phase)
        assertEquals("viewer", stage.myRole)
        assertEquals("battle-001", stage.activeBattle?.id)
        assertEquals(725L, stage.activeBattle?.participants?.single()?.score)
        assertEquals(1, stage.activeBattle?.participants?.single()?.rank)
    }

    @Test
    fun usesDefaultGeneratedIdempotencyKeyWhenCallerDoesNotProvideOne() {
        val transport = RecordingLiveBattleTransport(stagePayload())
        val repository = LiveBattleRepository(accessTokenProvider = { "token" }, transport = transport)

        assertTrue(repository.contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 1)) is LiveBattleContributionResult.Success)
        assertTrue(transport.calls.single().idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{8,128}$")))
    }

    @Test
    fun rejectsUnsafeIdsNonPositiveCoinsInvalidKeyAndMissingAuthenticationWithoutRequest() {
        val transport = RecordingLiveBattleTransport(stagePayload())
        val repository = LiveBattleRepository(accessTokenProvider = { "token" }, transport = transport)

        assertTrue(repository.contributeCoins("../battle", LiveBattleCoinContribution("viewer-456", 5), "key-12345") is LiveBattleContributionResult.Failure)
        assertTrue(repository.contributeCoins("battle-123", LiveBattleCoinContribution("bad/user", 5), "key-12345") is LiveBattleContributionResult.Failure)
        assertTrue(repository.contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 0), "key-12345") is LiveBattleContributionResult.Failure)
        assertTrue(repository.contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", -1), "key-12345") is LiveBattleContributionResult.Failure)
        assertTrue(repository.contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 5), "bad key") is LiveBattleContributionResult.Failure)
        assertTrue(LiveBattleRepository(accessTokenProvider = { null }, transport = transport)
            .contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 5), "key-12345") is LiveBattleContributionResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun preservesHttpStatusFromTransport() {
        val transport = RecordingLiveBattleTransport(stagePayload()).apply {
            error = LiveBattleHttpException(409, "Battle is no longer active.")
        }
        val result = LiveBattleRepository(accessTokenProvider = { "token" }, transport = transport)
            .contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 5), "key-12345")

        assertEquals(409, (result as LiveBattleContributionResult.Failure).statusCode)
        assertEquals("Battle is no longer active.", result.message)
    }

    @Test
    fun rejectsMalformedUpdatedStageInsteadOfReturningPartialState() {
        val result = LiveBattleRepository(
            accessTokenProvider = { "token" },
            transport = RecordingLiveBattleTransport(JSONObject("""{"liveId":"live-001","activeBattle":{"id":"battle-001","participants":[{"userId":"viewer-456","score":-1,"rank":1}]}}""")),
        ).contributeCoins("battle-123", LiveBattleCoinContribution("viewer-456", 5), "key-12345")

        assertTrue(result is LiveBattleContributionResult.Failure)
    }

    @Test
    fun stageCanRepresentNoActiveBattle() {
        val stage = parseLiveStageResponse(JSONObject("""{"liveId":"live-001","layout":"grid","phase":"idle","serverNow":"now","myRole":"viewer","activeBattle":null}"""))
        assertNull(stage.activeBattle)
        assertFalse(stage.phase.isBlank())
    }
}

private data class LiveBattleCall(
    val path: String,
    val accessToken: String,
    val idempotencyKey: String,
    val body: JSONObject,
)

private class RecordingLiveBattleTransport(private val response: JSONObject) : LiveBattleTransport {
    val calls = mutableListOf<LiveBattleCall>()
    var error: Exception? = null

    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        calls += LiveBattleCall(path, accessToken, idempotencyKey, JSONObject(body.toString()))
        error?.let { throw it }
        return response
    }
}

private fun stagePayload() = JSONObject(
    """{
        "liveId":"live-001",
        "layout":"battle",
        "phase":"battling",
        "serverNow":"2030-01-01T12:00:00Z",
        "myRole":"viewer",
        "activeBattle":{
            "id":"battle-001",
            "state":"active",
            "participants":[{"userId":"viewer-456","score":725,"rank":1,"state":"active"}]
        }
    }""".trimIndent(),
)
