package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CreatorApplicationRepositoryTest {
    @Test
    fun listsPayoutAccountsUsingAuthenticatedRnEndpointAndResponseFields() {
        var requestPath: String? = null
        var requestToken: String? = null
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            payoutAccountsTransport = CreatorPayoutAccountsTransport { path, token ->
                requestPath = path
                requestToken = token
                JSONObject(
                    """{"data":[{"id":"payout-1","bankCode":"058","bankName":"GTBank","accountNumberMasked":"••••4821","accountName":"Creator Name","countryCode":"NG","isDefault":true,"nameMatchStatus":"matched"}],"nextCursor":null}""",
                )
            },
        )

        val result = repository.listPayoutAccounts() as CreatorPayoutAccountsResult.Success

        assertEquals(CreatorApplicationRepository.PAYOUT_ACCOUNTS_PATH, requestPath)
        assertEquals("creator-access", requestToken)
        assertEquals(
            listOf(CreatorPayoutAccount("payout-1", "GTBank", "••••4821", "Creator Name")),
            result.accounts,
        )
    }

    @Test
    fun listsEmptyPayoutAccountPageAsEmptyList() {
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            payoutAccountsTransport = CreatorPayoutAccountsTransport { _, _ ->
                JSONObject("""{"data":[],"nextCursor":null}""")
            },
        )

        assertEquals(CreatorPayoutAccountsResult.Success(emptyList()), repository.listPayoutAccounts())
    }

    @Test
    fun refreshesSessionOnceWhenPayoutAccountListIsUnauthorized() {
        val tokens = mutableListOf<String>()
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { signedInSession().copy(accessToken = "creator-refreshed") },
            payoutAccountsTransport = CreatorPayoutAccountsTransport { _, token ->
                tokens += token
                if (tokens.size == 1) throw CreatorWorkspaceHttpException(401)
                JSONObject("""{"data":[],"nextCursor":null}""")
            },
        )

        val result = repository.listPayoutAccounts()

        assertEquals(CreatorPayoutAccountsResult.Success(emptyList()), result)
        assertEquals(listOf("creator-access", "creator-refreshed"), tokens)
    }

    @Test
    fun submitsRnContractAndStableIdempotencyKeyWithBearerSession() {
        var requestPath: String? = null
        var requestToken: String? = null
        var requestKey: String? = null
        var requestBody: JSONObject? = null
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            transport = CreatorApplicationTransport { path, token, key, body ->
                requestPath = path
                requestToken = token
                requestKey = key
                requestBody = body
                JSONObject("""{"data":{"id":"app-1","status":"pending","contentCategories":["tech"],"submittedAt":"2026-11-05T12:00:00Z","reviewedAt":null,"rejectionReason":null,"reapplyAvailableAt":null}}""")
            },
        )

        val result = repository.submit(
            CreatorApplicationSubmission(
                contentCategories = listOf("tech"),
                socialLinks = listOf(CreatorApplicationSocialLink("instagram", "https://instagram.com/creator")),
                sampleContentUrls = emptyList(),
                payoutAccountId = null,
                acceptedCreatorTermsVersion = "2026-09",
            ),
            "stable-submit-key",
        ) as CreatorWorkspaceResult.Success

        assertEquals("pending", result.value.status)
        assertEquals(CreatorApplicationRepository.APPLICATION_SUBMIT_PATH, requestPath)
        assertEquals("creator-access", requestToken)
        assertEquals("stable-submit-key", requestKey)
        assertEquals(listOf("tech"), requestBody?.getJSONArray("contentCategories")?.let { listOf(it.getString(0)) })
        assertEquals("instagram", requestBody?.getJSONArray("socialLinks")?.getJSONObject(0)?.getString("platform"))
        assertEquals("https://instagram.com/creator", requestBody?.getJSONArray("socialLinks")?.getJSONObject(0)?.getString("url"))
        assertEquals(0, requestBody?.getJSONArray("sampleContentUrls")?.length())
        assertFalse(requestBody?.has("payoutAccountId") == true)
        assertEquals("2026-09", requestBody?.getString("acceptedCreatorTermsVersion"))
    }

    @Test
    fun refreshesSessionOnceOnUnauthorizedSubmitAndReusesIdempotencyKey() {
        val tokens = mutableListOf<String>()
        val keys = mutableListOf<String>()
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { signedInSession().copy(accessToken = "creator-refreshed") },
            transport = CreatorApplicationTransport { _, token, key, _ ->
                tokens += token
                keys += key
                if (tokens.size == 1) throw CreatorWorkspaceHttpException(401)
                pendingResponse()
            },
        )

        val result = repository.submit(validSubmission(), "retry-same-key")

        assertTrue(result is CreatorWorkspaceResult.Success)
        assertEquals(listOf("creator-access", "creator-refreshed"), tokens)
        assertEquals(listOf("retry-same-key", "retry-same-key"), keys)
    }

    @Test
    fun rejectsInvalidCategoryCountBeforeSendingRequest() {
        var requests = 0
        val repository = CreatorApplicationRepository(
            sessionProvider = ::signedInSession,
            transport = CreatorApplicationTransport { _, _, _, _ -> requests += 1; pendingResponse() },
        )

        val result = repository.submit(validSubmission().copy(contentCategories = listOf("fashion", "beauty", "tech", "food")), "key")

        assertTrue(result is CreatorWorkspaceResult.Failure)
        assertEquals(0, requests)
    }

    private fun validSubmission() = CreatorApplicationSubmission(
        contentCategories = listOf("fashion"),
        socialLinks = emptyList(),
        sampleContentUrls = emptyList(),
        payoutAccountId = null,
        acceptedCreatorTermsVersion = "2026-09",
    )

    private fun pendingResponse() = JSONObject(
        """{"id":"app-1","status":"pending","contentCategories":["fashion"],"submittedAt":"2026-11-05T12:00:00Z","reviewedAt":null,"rejectionReason":null,"reapplyAvailableAt":null}""",
    )

    private fun signedInSession() = AccountSession(
        "creator-access",
        "creator-refresh",
        AccountUser("account-1", "Creator", "creator", null, null, emptyList()),
    )
}
