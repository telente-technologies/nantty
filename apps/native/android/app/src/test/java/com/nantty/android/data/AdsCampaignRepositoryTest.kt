package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection

class AdsCampaignRepositoryTest {
    private val userId = "33333333-3333-4333-8333-333333333333"
    private val postId = "44444444-4444-4444-8444-444444444444"
    private val productId = "55555555-5555-4555-8555-555555555555"
    private val boostId = "66666666-6666-4666-8666-666666666666"

    @Test
    fun optionsAndDestinationRequestsUseCanonicalAuthenticatedRoutes() {
        val calls = mutableListOf<Triple<String, String, String>>()
        val repo = repository { method, path, token, _, _ ->
            calls += Triple(method, path, token)
            when (path) {
                AdsCampaignRepository.OPTIONS_PATH -> optionsJson()
                AdsCampaignRepository.MY_PROFILE_PATH -> JSONObject("""{"data":{"id":"$userId","storeId":"$productId","countryCode":"GH"}}""")
                "/api/v1/users/$userId/posts?visibility=public" -> JSONObject("""{"data":{"data":[{"id":"$postId","text":"A post to promote"}],"nextCursor":null}}""")
                AdsCampaignRepository.PRODUCTS_PATH -> JSONObject("""{"data":[{"id":"$productId","name":"Nantty bag","status":"active"},{"id":"77777777-7777-4777-8777-777777777777","name":"Draft","status":"draft"}]}""")
                else -> error("Unexpected route $path")
            }
        }

        val options = (repo.loadOptions() as AdsCampaignResult.Success).value
        val destinations = (repo.loadDestinations() as AdsCampaignResult.Success).value

        assertEquals(AdsWorkspaceMoney(2_000, "NGN"), options.minimumDailyBudget)
        assertEquals(listOf("views", "profile_visits", "messages"), options.goalsByDestination["post"])
        assertEquals(listOf("card", "ad_balance", "free"), options.paymentOptions.map { it.method })
        assertEquals(AdsWorkspaceMoney(8_000, "NGN"), options.adBalanceSpendable)
        assertEquals(AdsCampaignDestination("profile", userId, "Your profile"), destinations.profile)
        assertEquals("GH", destinations.defaultCountryCode)
        assertEquals(AdsCampaignDestination("post", postId, "A post to promote"), destinations.posts.single())
        assertEquals(AdsCampaignDestination("product", productId, "Nantty bag"), destinations.products.single())
        assertEquals(listOf("GET" to AdsCampaignRepository.OPTIONS_PATH, "GET" to AdsCampaignRepository.MY_PROFILE_PATH,
            "GET" to "/api/v1/users/$userId/posts?visibility=public", "GET" to AdsCampaignRepository.PRODUCTS_PATH),
            calls.map { it.first to it.second })
        assertTrue(calls.all { it.third == "ads-access" })
    }

    @Test
    fun locationSearchEncodesUserTextAndScopesStatesToSelectedCountry() {
        val calls = mutableListOf<String>()
        val repo = repository { _, path, _, _, _ ->
            calls += path
            JSONObject("""{"data":{"locations":[{"code":"GH-AC","name":"Greater Accra","type":"state"}]}}""")
        }

        val locations = (repo.searchLocations("Accra & coast", "GH") as AdsCampaignResult.Success).value

        assertEquals(listOf("/api/v1/ads/locations?search=Accra%20%26%20coast&countryCode=GH"), calls)
        assertEquals(listOf(AdsCampaignLocation("GH-AC", "Greater Accra", "state")), locations)
    }

    @Test
    fun estimateAndCreateBodiesMatchBoostApiIncludingPostTargetAndTotalDailyDerivation() {
        val requests = mutableListOf<Triple<String, String, JSONObject?>>()
        val repo = repository { method, path, _, body, key ->
            requests += Triple("$method:$path:${key.orEmpty()}", "body", body)
            when (path) {
                AdsCampaignRepository.ESTIMATE_PATH -> JSONObject("""{"data":{"estimatedReachMin":100,"estimatedReachMax":200,"estimatedResultsLabel":"Post views","totalCost":{"amountMinor":7000,"currency":"NGN"}}}""")
                AdsCampaignRepository.BOOSTS_PATH -> JSONObject("""{"data":{"boost":{"id":"$boostId"},"checkoutUrl":null}}""")
                else -> error("Unexpected route $path")
            }
        }
        val draft = validDraft().copy(
            budgetType = "total",
            dailyBudget = AdsWorkspaceMoney(999, "NGN"),
            totalBudget = AdsWorkspaceMoney(10_001, "NGN"),
        )

        val estimate = (repo.estimate(draft) as AdsCampaignResult.Success).value
        val create = repo.create(draft, "request_key_123456") as AdsCampaignResult.Success
        val estimateBody = requests[0].third!!
        val createBody = requests[1].third!!

        assertEquals(100L, estimate.reachMin)
        assertEquals(200L, estimate.reachMax)
        assertEquals(AdsWorkspaceMoney(7_000, "NGN"), estimate.totalCost)
        assertEquals(AdsCampaignCreated(boostId, null), create.value)
        assertEquals(postId, estimateBody.getString("postId"))
        assertEquals("post", estimateBody.getString("destinationType"))
        assertEquals(postId, estimateBody.getString("targetId"))
        assertEquals(10_001L, estimateBody.getJSONObject("totalBudget").getLong("amountMinor"))
        assertEquals(3_334L, estimateBody.getJSONObject("dailyBudget").getLong("amountMinor"))
        assertFalse(estimateBody.has("paymentMethod"))
        assertEquals("ad_balance", createBody.getString("paymentMethod"))
        assertTrue(isAllowedAdsCampaignRequest("POST", AdsCampaignRepository.ESTIMATE_PATH, estimateBody, null))
        assertTrue(isAllowedAdsCampaignRequest("POST", AdsCampaignRepository.BOOSTS_PATH, createBody, "request_key_123456"))
        assertEquals("POST:${AdsCampaignRepository.BOOSTS_PATH}:request_key_123456", requests[1].first)
    }

    @Test
    fun customAudienceValidationRejectsServerLimitViolationsAndUnsupportedTargets() {
        val base = validDraft()
        val tooManyAreas = base.copy(audience = base.audience.copy(mode = "custom", states = (1..31).map { "state-$it" }))
        val invalidAge = base.copy(audience = base.audience.copy(mode = "custom", ageMin = 17, ageMax = 65))
        val tooManyTopics = base.copy(audience = base.audience.copy(mode = "custom", topicIds = (1..21).map { "topic-$it" }))
        val unsafeTarget = base.copy(destination = AdsCampaignDestination("post", "bad/path", "Bad post"))

        assertNull(buildAdsCampaignEstimateBody(tooManyAreas))
        assertNull(buildAdsCampaignEstimateBody(invalidAge))
        assertNull(buildAdsCampaignEstimateBody(tooManyTopics))
        assertNull(buildAdsCampaignEstimateBody(unsafeTarget))
        assertNull(buildAdsCampaignEstimateBody(base.copy(goal = "store_visits")))
    }

    @Test
    fun minimumDailyBudgetUsesServerFloorForDailyAndTotalCampaigns() {
        val options = (repository { _, _, _, _, _ -> optionsJson() }.loadOptions() as AdsCampaignResult.Success).value

        assertTrue(adsCampaignMinimumBudgetValid(options, validDraft()))
        assertFalse(adsCampaignMinimumBudgetValid(options, validDraft().copy(dailyBudget = AdsWorkspaceMoney(1_999, "NGN"))))
        assertTrue(adsCampaignMinimumBudgetValid(options, validDraft().copy(budgetType = "total", durationDays = 3, totalBudget = AdsWorkspaceMoney(6_000, "NGN"))))
        assertFalse(adsCampaignMinimumBudgetValid(options, validDraft().copy(budgetType = "total", durationDays = 3, totalBudget = AdsWorkspaceMoney(5_999, "NGN"))))
        assertFalse(adsCampaignMinimumBudgetValid(options, validDraft().copy(dailyBudget = AdsWorkspaceMoney(5_000, "USD"))))
    }

    @Test
    fun createIdempotencyReusesRetriesButRotatesOnPayloadChangeOrSuccessReset() {
        var generated = 0
        val keys = AdsCreateIdempotencyKeys { "generated_key_${++generated}" }
        val first = buildAdsCampaignCreateBody(validDraft())!!
        val changed = buildAdsCampaignCreateBody(validDraft().copy(durationDays = 7))!!

        assertEquals("generated_key_1", keys.keyFor(first))
        assertEquals("generated_key_1", keys.keyFor(JSONObject(first.toString())))
        assertEquals("generated_key_2", keys.keyFor(changed))
        keys.reset()
        assertEquals("generated_key_3", keys.keyFor(changed))
    }

    @Test
    fun malformedIdempotencyAndUntrustedCheckoutUrlAreRejected() {
        var calls = 0
        val repo = repository { _, _, _, _, _ -> calls++; JSONObject("""{"data":{"boost":{"id":"$boostId"},"checkoutUrl":"https://checkout.example/pay"}}""") }

        assertTrue(repo.create(validDraft(), "bad key") is AdsCampaignResult.Failure)
        assertEquals(0, calls)
        assertFalse(isSafeAdsCheckoutUrl("javascript:alert(1)"))
        assertFalse(isSafeAdsCheckoutUrl("https://user:secret@example.test/checkout"))
        assertTrue(isSafeAdsCheckoutUrl("https://checkout.example/pay"))
        assertFalse(isSafeAdsCampaignId("null"))
        assertFalse(isSafeAdsCampaignId("bad/path"))
    }

    @Test
    fun createResponseRequiresCanonicalBoostIdentityAndValidCheckoutUrl() {
        val invalid = repository { _, _, _, _, _ ->
            JSONObject("""{"data":{"boost":{"id":"not-an-id"},"checkoutUrl":null}}""")
        }.create(validDraft(), "request_key_123456")
        val badUrl = repository { _, _, _, _, _ ->
            JSONObject("""{"data":{"boost":{"id":"$boostId"},"checkoutUrl":"http://checkout.example/pay"}}""")
        }.create(validDraft(), "request_key_123456")

        assertTrue(invalid is AdsCampaignResult.Failure)
        assertTrue(badUrl is AdsCampaignResult.Failure)
    }

    @Test
    fun resubmitSourceOnlyAcceptsRejectedCampaignsMarkedByServer() {
        val valid = repository { _, _, _, _, _ -> rejectedBoost() }.loadResubmitSource(boostId) as AdsCampaignResult.Success
        val notAllowed = repository { _, _, _, _, _ -> rejectedBoost().apply { getJSONObject("data").put("actions", JSONObject("""{"resubmit":false}""")) } }
            .loadResubmitSource(boostId)
        val wrongStatus = repository { _, _, _, _, _ -> rejectedBoost().apply { getJSONObject("data").put("status", "active") } }.loadResubmitSource(boostId)

        assertEquals("post", valid.value.destination.type)
        assertEquals(postId, valid.value.destination.targetId)
        assertEquals("POLICY", valid.value.rejectionReason)
        assertTrue(notAllowed is AdsCampaignResult.Failure)
        assertTrue(wrongStatus is AdsCampaignResult.Failure)
    }

    @Test
    fun repositoryReportsAuthenticationErrorsAndRefreshesOnce() {
        val tokens = mutableListOf<String>()
        val repo = AdsCampaignRepository(
            sessionProvider = ::session,
            refreshSessionProvider = { session().copy(accessToken = "fresh-token") },
            transport = AdsCampaignTransport { _, _, token, _, _ ->
                tokens += token
                if (token == "ads-access") throw AdsWorkspaceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
                optionsJson()
            },
        )

        assertTrue(repo.loadOptions() is AdsCampaignResult.Success)
        assertEquals(listOf("ads-access", "fresh-token"), tokens)
        val signedOut = AdsCampaignRepository({ null }, transport = AdsCampaignTransport { _, _, _, _, _ -> error("unexpected network") })
        val failure = signedOut.loadOptions() as AdsCampaignResult.Failure
        assertTrue(failure.authenticationRequired)
    }

    @Test
    fun transportAllowlistRejectsUnexpectedMutationsAndCreateWithoutIdempotency() {
        val body = buildAdsCampaignCreateBody(validDraft())!!
        assertFalse(isAllowedAdsCampaignRequest("DELETE", AdsCampaignRepository.BOOSTS_PATH, body, "request_key_123456"))
        assertFalse(isAllowedAdsCampaignRequest("POST", AdsCampaignRepository.BOOSTS_PATH, body, null))
        assertFalse(isAllowedAdsCampaignRequest("GET", "/api/v1/ads/boosts/../../users", null, null))
        assertTrue(isAllowedAdsCampaignRequest("POST", AdsCampaignRepository.ESTIMATE_PATH, JSONObject(), null))
    }

    private fun repository(transport: AdsCampaignTransport) = AdsCampaignRepository(::session, transport = transport)
    private fun session() = AccountSession("ads-access", "refresh", AccountUser(userId, "Ari", "ari", null, null, emptyList()))
    private fun validDraft() = AdsCampaignDraft(
        destination = AdsCampaignDestination("post", postId, "Post"),
        goal = "views",
        audience = AdsCampaignAudience(),
        budgetType = "daily",
        dailyBudget = AdsWorkspaceMoney(2_000, "NGN"),
        durationDays = 3,
        paymentMethod = "ad_balance",
    )

    private fun optionsJson() = JSONObject("""
        {"data":{
          "minimumDailyBudget":{"amountMinor":2000,"currency":"NGN"},
          "suggestedDailyBudgets":[{"amountMinor":2000,"currency":"NGN"},{"amountMinor":5000,"currency":"NGN"}],
          "durationDayOptions":[1,3,7],"interests":["fashion"],"maximumDurationDays":30,"maximumScheduleDays":60,
          "goalsByDestination":{"post":["views","profile_visits","messages"],"profile":["profile_visits"],"store":["store_visits"],"product":["product_visits"]},
          "freeBoost":{"premium":true,"eligible":true,"remainingThisMonth":1,"maxTotal":{"amountMinor":10000,"currency":"NGN"},"resetsAt":null},
          "adBalance":{"spendable":{"amountMinor":8000,"currency":"NGN"}},
          "paymentOptions":[{"method":"card","available":true,"reasonCode":null,"reason":null},{"method":"ad_balance","available":true,"reasonCode":null,"reason":null},{"method":"free","available":true,"reasonCode":null,"reason":null}]
        }}
    """.trimIndent())

    private fun rejectedBoost() = JSONObject("""
        {"data":{"id":"$boostId","postId":"$postId","targetId":"$postId","destinationType":"post","status":"rejected","goal":"views","budgetType":"daily","dailyBudget":{"amountMinor":2000,"currency":"NGN"},"durationDays":3,"totalBudget":{"amountMinor":6000,"currency":"NGN"},"audience":{"mode":"automatic"},"rejectionReason":"POLICY","actions":{"resubmit":true}}}
    """.trimIndent())
}
