package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.UUID

/** Native create/resubmit client for the same boost contract used by React Native. */
internal class AdsCampaignRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: AdsCampaignTransport = JdkAdsCampaignTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun loadOptions(): AdsCampaignResult<AdsCampaignOptions> = request("load ad options") { token ->
        parseOptions(transport.request("GET", OPTIONS_PATH, token, null, null))
    }

    fun searchLocations(search: String, countryCode: String): AdsCampaignResult<List<AdsCampaignLocation>> = request("load ad locations") { token ->
        require(search.length <= 80 && countryCode.length <= 2) { "Search for a shorter location name." }
        val path = "$LOCATIONS_PATH?${listOfNotNull(
            search.takeIf(String::isNotBlank)?.let { "search=${encodeAdsCampaignQuery(it)}" },
            countryCode.takeIf(String::isNotBlank)?.let { "countryCode=${encodeAdsCampaignQuery(it)}" },
        ).joinToString("&")}".removeSuffix("?")
        parseLocations(transport.request("GET", path, token, null, null))
    }

    fun loadTopics(): AdsCampaignResult<List<AdsCampaignTopic>> = request("load ad interests") { token ->
        val rows = transport.request("GET", TOPICS_PATH, token, null, null).campaignRows()
        buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isSafeAdsCampaignId) ?: continue
                val name = row.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
                add(AdsCampaignTopic(id, name.take(80)))
            }
        }
    }

    fun loadDestinations(): AdsCampaignResult<AdsCampaignDestinations> = request("load what you can promote") { token ->
        val session = requireNotNull(sessionProvider())
        val profilePayload = transport.request("GET", MY_PROFILE_PATH, token, null, null).campaignData()
        val storeId = profilePayload.optString("storeId").takeIf(::isSafeAdsCampaignId)
        val countryCode = profilePayload.optString("countryCode").takeIf { it.matches(Regex("[A-Za-z]{2}")) }?.uppercase()
        val postsPayload = transport.request("GET", userPostsPath(session.user.id), token, null, null)
        val productsPayload = if (storeId == null) null else transport.request("GET", PRODUCTS_PATH, token, null, null)
        val posts = parsePosts(postsPayload)
        val products = productsPayload?.let(::parseProducts).orEmpty()
        AdsCampaignDestinations(
            profile = AdsCampaignDestination("profile", session.user.id, "Your profile"),
            store = storeId?.let { AdsCampaignDestination("store", it, "Your store") },
            posts = posts,
            products = products,
            defaultCountryCode = countryCode,
        )
    }

    fun loadResubmitSource(boostId: String): AdsCampaignResult<AdsCampaignResubmitSource> {
        if (!isAdsWorkspaceUuid(boostId)) return AdsCampaignResult.Failure("This rejected ad is unavailable.")
        return request("load the rejected ad") { token ->
            val row = transport.request("GET", "$BOOSTS_PATH/$boostId", token, null, null).campaignData()
            require(row.optString("status") == "rejected" && row.optJSONObject("actions")?.optBoolean("resubmit") == true) {
                "Only rejected ads that Nantty allows to resubmit can be reused here."
            }
            val destinationType = row.optString("destinationType")
            val targetId = row.optString("targetId").takeIf(::isSafeAdsCampaignId)
                ?: row.optString("postId").takeIf(::isSafeAdsCampaignId)
                ?: error("Nantty returned an ad without a valid destination.")
            val total = row.optJSONObject("totalBudget")?.let(::parseMoney)
            val daily = row.optJSONObject("dailyBudget")?.let(::parseMoney)
                ?: total?.let {
                    val days = row.optInt("durationDays", 1).coerceAtLeast(1)
                    AdsWorkspaceMoney(it.amountMinor / days + if (it.amountMinor % days == 0L) 0 else 1, it.currency)
                }
                ?: error("Nantty returned an ad without a valid budget.")
            AdsCampaignResubmitSource(
                destination = AdsCampaignDestination(destinationType, targetId, destinationLabel(destinationType)),
                goal = row.optString("goal").takeIf { it in BOOST_GOALS } ?: error("Nantty returned an ad with an invalid goal."),
                audience = row.optJSONObject("audience")?.let(::parseAudience) ?: AdsCampaignAudience(),
                budgetType = row.optString("budgetType").takeIf { it == "daily" || it == "total" } ?: "daily",
                dailyBudget = daily,
                totalBudget = total,
                durationDays = row.optInt("durationDays").takeIf { it in 1..30 } ?: error("Nantty returned an invalid ad duration."),
                rejectionReason = row.optString("rejectionReason").takeIf { it.isNotBlank() && it != "null" },
            )
        }
    }

    fun estimate(draft: AdsCampaignDraft): AdsCampaignResult<AdsCampaignEstimate> {
        val body = buildEstimateBody(draft) ?: return AdsCampaignResult.Failure("Complete the ad details before estimating reach.")
        return request("estimate ad reach") { token ->
            val data = transport.request("POST", ESTIMATE_PATH, token, body, null).campaignData()
            AdsCampaignEstimate(
                reachMin = data.requiredNonNegativeLong("estimatedReachMin"),
                reachMax = data.requiredNonNegativeLong("estimatedReachMax"),
                resultLabel = data.optString("estimatedResultsLabel").takeIf(String::isNotBlank)
                    ?: error("Nantty returned an incomplete ad estimate."),
                totalCost = parseMoney(data.optJSONObject("totalCost") ?: error("Nantty returned an incomplete ad estimate.")),
            )
        }
    }

    fun create(draft: AdsCampaignDraft, idempotencyKey: String): AdsCampaignResult<AdsCampaignCreated> {
        val body = buildCreateBody(draft) ?: return AdsCampaignResult.Failure("Complete the ad details before submitting.")
        if (!ADS_IDEMPOTENCY_PATTERN.matches(idempotencyKey)) return AdsCampaignResult.Failure("This ad submission is invalid. Try again.")
        return request("submit your ad") { token ->
            val data = transport.request("POST", BOOSTS_PATH, token, body, idempotencyKey).campaignData()
            val boost = data.optJSONObject("boost") ?: error("Nantty did not confirm the submitted ad.")
            val boostId = boost.optString("id").takeIf(::isAdsWorkspaceUuid)
                ?: error("Nantty returned an invalid ad confirmation.")
            val checkoutUrl = data.optString("checkoutUrl").takeIf { it.isNotBlank() && it != "null" }
            if (checkoutUrl != null) require(isSafeAdsCheckoutUrl(checkoutUrl)) { "Nantty returned an invalid checkout link." }
            AdsCampaignCreated(boostId, checkoutUrl)
        }
    }

    private fun <T> request(action: String, block: (String) -> T): AdsCampaignResult<T> {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return AdsCampaignResult.Failure("Sign in to $action.", authenticationRequired = true)
        return try {
        val result = try {
            block(session.accessToken)
        } catch (error: AdsWorkspaceHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw AdsWorkspaceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            block(refreshed)
        }
        AdsCampaignResult.Success(result)
    } catch (error: Exception) {
        AdsCampaignResult.Failure(
            error.message?.takeIf(String::isNotBlank) ?: "Couldn't $action. Check your connection and try again.",
            authenticationRequired = error is AdsWorkspaceHttpException && error.statusCode in setOf(401, 403),
        )
    }
    }

    private fun parseOptions(payload: JSONObject): AdsCampaignOptions {
        val data = payload.campaignData()
        val minimum = parseMoney(data.optJSONObject("minimumDailyBudget") ?: error("Nantty returned incomplete ad options."))
        val suggested = data.optJSONArray("suggestedDailyBudgets")?.parseMoneyArray()
            ?: error("Nantty returned incomplete ad options.")
        val durations = data.optJSONArray("durationDayOptions")?.let { array ->
            (0 until array.length()).mapNotNull { index -> array.optInt(index).takeIf { it in 1..30 } }.distinct().sorted()
        } ?: error("Nantty returned incomplete ad options.")
        require(suggested.isNotEmpty() && durations.isNotEmpty()) { "Nantty returned incomplete ad options." }
        val free = data.optJSONObject("freeBoost") ?: error("Nantty returned incomplete ad options.")
        val paymentOptions = data.optJSONArray("paymentOptions")?.let { array ->
            (0 until array.length()).mapNotNull { index -> array.optJSONObject(index) }.map { item ->
                val method = item.optString("method").takeIf { it in PAYMENT_METHODS }
                    ?: error("Nantty returned an unsupported ad payment option.")
                AdsCampaignPaymentOption(method, item.optBoolean("available"), item.optString("reason").takeIf { it.isNotBlank() && it != "null" })
            }
        } ?: error("Nantty returned incomplete ad payment options.")
        val goalsObject = data.optJSONObject("goalsByDestination") ?: error("Nantty returned incomplete ad goals.")
        val goals = DESTINATION_TYPES.associateWith { type ->
            val array = goalsObject.optJSONArray(type) ?: JSONArray()
            (0 until array.length()).mapNotNull { index -> array.optString(index).takeIf { it in BOOST_GOALS } }
        }
        return AdsCampaignOptions(
            minimumDailyBudget = minimum,
            suggestedDailyBudgets = suggested,
            durationDays = durations,
            interests = data.optJSONArray("interests")?.stringValues().orEmpty().take(MAX_INTERESTS),
            paymentOptions = paymentOptions,
            freeBoostEligible = free.optBoolean("eligible"),
            freeBoostRemaining = free.optInt("remainingThisMonth", 0).coerceAtLeast(0),
            freeBoostMaxTotal = free.optJSONObject("maxTotal")?.let(::parseMoney),
            adBalanceSpendable = data.optJSONObject("adBalance")?.optJSONObject("spendable")?.let(::parseMoney),
            maximumDurationDays = data.optInt("maximumDurationDays", 30).coerceIn(1, 30),
            maximumScheduleDays = data.optInt("maximumScheduleDays", 60).coerceIn(0, 60),
            goalsByDestination = goals,
        )
    }

    private fun parsePosts(payload: JSONObject): List<AdsCampaignDestination> {
        val outer = payload.campaignData()
        val page = outer.optJSONObject("data") ?: outer
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items") ?: JSONArray()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isSafeAdsCampaignId) ?: continue
                val label = row.optString("text").trim().takeIf(String::isNotEmpty)
                    ?: if (row.optJSONArray("media")?.length()?.let { it > 0 } == true) "Photo or video post" else "Post"
                add(AdsCampaignDestination("post", id, label.take(160)))
            }
        }
    }

    private fun parseProducts(payload: JSONObject): List<AdsCampaignDestination> {
        val rows = payload.campaignData().optJSONArray("data") ?: JSONArray()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("status") != "active") continue
                val id = row.optString("id").takeIf(::isSafeAdsCampaignId) ?: continue
                val label = row.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
                add(AdsCampaignDestination("product", id, label.take(160)))
            }
        }
    }

    private fun parseLocations(payload: JSONObject): List<AdsCampaignLocation> {
        val rows = payload.campaignRows()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val code = row.optString("code").takeIf { it.isNotBlank() && it.length <= 80 } ?: continue
                val name = row.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
                val type = row.optString("type").takeIf { it in setOf("country", "state", "city", "region") } ?: continue
                add(AdsCampaignLocation(code, name.take(120), type))
            }
        }
    }

    companion object {
        const val OPTIONS_PATH = "/api/v1/ads/boosts/options"
        const val ESTIMATE_PATH = "/api/v1/ads/boosts/estimate"
        const val BOOSTS_PATH = "/api/v1/ads/boosts"
        const val MY_PROFILE_PATH = "/api/v1/users/me"
        const val PRODUCTS_PATH = "/api/v1/seller/products?limit=100"
        const val TOPICS_PATH = "/api/v1/topics"
        const val LOCATIONS_PATH = "/api/v1/ads/locations"
        private val DESTINATION_TYPES = setOf("post", "profile", "store", "product")
        private val BOOST_GOALS = setOf("views", "profile_visits", "messages", "store_visits", "product_visits")
        private val PAYMENT_METHODS = setOf("card", "ad_balance", "balance", "free", "wallet")
        private const val MAX_INTERESTS = 20
    }
}

internal fun buildAdsCampaignEstimateBody(draft: AdsCampaignDraft): JSONObject? = buildAdsCampaignBody(draft, includePayment = false)
internal fun buildAdsCampaignCreateBody(draft: AdsCampaignDraft): JSONObject? = buildAdsCampaignBody(draft, includePayment = true)

private fun buildAdsCampaignBody(draft: AdsCampaignDraft, includePayment: Boolean): JSONObject? {
    val destination = draft.destination ?: return null
    val goal = draft.goal?.takeIf { it in ADS_GOALS_BY_DESTINATION[destination.type].orEmpty() } ?: return null
    val duration = draft.durationDays?.takeIf { it in 1..30 } ?: return null
    val suppliedDailyBudget = draft.dailyBudget?.takeIf { it.amountMinor > 0 && it.currency.matches(Regex("[A-Z]{3}")) } ?: return null
    if (destination.type !in setOf("post", "profile", "store", "product") || !isSafeAdsCampaignId(destination.targetId)) return null
    if (draft.audience.mode !in setOf("automatic", "custom")) return null
    val audience = JSONObject().put("mode", draft.audience.mode)
    if (draft.audience.mode == "custom") {
        val a = draft.audience
        if (!a.countryCode.matches(Regex("[A-Za-z]{2}")) || a.ageMin !in 18..65 || a.ageMax !in a.ageMin..65 ||
            a.states.size > 30 || a.interests.size > 20 || a.topicIds.size > 20 || a.gender !in setOf("all", "female", "male") ||
            (a.states + a.interests + a.topicIds).any { it.isBlank() || it.length > 80 }) return null
        audience.put("countryCode", a.countryCode.uppercase())
            .put("states", JSONArray(a.states)).put("interests", JSONArray(a.interests))
            .put("ageMin", a.ageMin).put("ageMax", a.ageMax).put("gender", a.gender)
            .put("topicIds", JSONArray(a.topicIds))
    }
    val dailyBudget = if (draft.budgetType == "total") {
        val total = draft.totalBudget?.takeIf { it.amountMinor > 0 && it.currency == suppliedDailyBudget.currency } ?: return null
        val days = duration.toLong()
        AdsWorkspaceMoney(total.amountMinor / days + if (total.amountMinor % days == 0L) 0 else 1, total.currency)
    } else suppliedDailyBudget
    val body = JSONObject()
        .put("destinationType", destination.type)
        .put("targetId", destination.targetId)
        .put("goal", goal)
        .put("audience", audience)
        .put("budgetType", draft.budgetType)
        .put("dailyBudget", moneyJson(dailyBudget))
        .put("durationDays", duration)
    if (destination.type == "post") body.put("postId", destination.targetId)
    if (draft.budgetType == "total") {
        val total = draft.totalBudget?.takeIf { it.amountMinor > 0 && it.currency == dailyBudget.currency } ?: return null
        body.put("totalBudget", moneyJson(total))
    } else if (draft.budgetType != "daily") return null
    draft.startAt?.let { body.put("startAt", it) }
    if (includePayment) {
        val method = draft.paymentMethod?.takeIf { it in setOf("card", "ad_balance", "balance", "free", "wallet") } ?: return null
        body.put("paymentMethod", method)
    }
    return body
}

internal class AdsCreateIdempotencyKeys(private val generate: () -> String = { UUID.randomUUID().toString() }) {
    private var signature: String? = null
    private var currentKey: String? = null

    fun keyFor(body: JSONObject): String {
        val nextSignature = body.toString()
        if (signature != nextSignature || currentKey == null) {
            signature = nextSignature
            currentKey = generate()
        }
        return requireNotNull(currentKey)
    }

    fun reset() { signature = null; currentKey = null }
}

internal fun userPostsPath(userId: String): String {
    require(isSafeAdsCampaignId(userId)) { "This account is unavailable." }
    return "/api/v1/users/$userId/posts?visibility=public"
}

private class JdkAdsCampaignTransport(private val baseUrl: String) : AdsCampaignTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to manage ads." }
        require(isAllowedAdsCampaignRequest(method, path, body, idempotencyKey)) { "Unsupported ads campaign request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage ads.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("X-Client-Platform", "android")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            if (idempotencyKey != null) setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            body?.let { connection.outputStream.use { output -> output.write(it.toString().toByteArray(StandardCharsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { reader ->
                val text = reader.readText()
                require(text.toByteArray(StandardCharsets.UTF_8).size <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large ads response." }
                text
            }.orEmpty()
            if (status !in 200..299) throw AdsWorkspaceHttpException(status)
            require(response.isNotBlank()) { "Nantty returned an empty ads response." }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    companion object { private const val MAX_RESPONSE_BYTES = 1_048_576 }
}

internal fun isAllowedAdsCampaignRequest(method: String, path: String, body: JSONObject?, key: String?): Boolean {
    if (method == "GET" && body == null && key == null) return path == AdsCampaignRepository.OPTIONS_PATH ||
        path == AdsCampaignRepository.MY_PROFILE_PATH || path == AdsCampaignRepository.PRODUCTS_PATH ||
        Regex("^/api/v1/ads/boosts/[0-9a-fA-F-]{36}$").matches(path) ||
        path == AdsCampaignRepository.TOPICS_PATH || path == AdsCampaignRepository.LOCATIONS_PATH ||
        path.startsWith("${AdsCampaignRepository.LOCATIONS_PATH}?") ||
        Regex("^/api/v1/users/[0-9a-fA-F-]{36}/posts\\?visibility=public$").matches(path)
    if (method == "POST" && body != null && key == null) return path == AdsCampaignRepository.ESTIMATE_PATH
    return method == "POST" && path == AdsCampaignRepository.BOOSTS_PATH && body != null && key != null && ADS_IDEMPOTENCY_PATTERN.matches(key)
}

internal fun isSafeAdsCampaignId(value: String): Boolean = value != "null" && value.length in 1..80 && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
internal fun isSafeAdsCheckoutUrl(value: String): Boolean = runCatching {
    val uri = java.net.URI(value)
    uri.isAbsolute && uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null
}.getOrDefault(false)

internal fun adsCampaignMinimumBudgetValid(options: AdsCampaignOptions, draft: AdsCampaignDraft): Boolean {
    if (draft.budgetType == "total") {
        val total = draft.totalBudget ?: return false
        if (total.currency != options.minimumDailyBudget.currency) return false
        val days = draft.durationDays?.takeIf { it in 1..30 } ?: return false
        val minimumTotal = runCatching { Math.multiplyExact(options.minimumDailyBudget.amountMinor, days.toLong()) }.getOrNull()
            ?: return false
        return total.amountMinor >= minimumTotal
    }
    if (draft.budgetType != "daily") return false
    val daily = draft.dailyBudget ?: return false
    return daily.currency == options.minimumDailyBudget.currency && daily.amountMinor >= options.minimumDailyBudget.amountMinor
}

private val ADS_GOALS_BY_DESTINATION = mapOf(
    "post" to setOf("views", "profile_visits", "messages"),
    "profile" to setOf("profile_visits"),
    "store" to setOf("store_visits"),
    "product" to setOf("product_visits"),
)

private fun buildEstimateBody(draft: AdsCampaignDraft): JSONObject? = buildAdsCampaignEstimateBody(draft)
private fun buildCreateBody(draft: AdsCampaignDraft): JSONObject? = buildAdsCampaignCreateBody(draft)
private fun moneyJson(money: AdsWorkspaceMoney) = JSONObject().put("amountMinor", money.amountMinor).put("currency", money.currency)
private fun parseMoney(json: JSONObject): AdsWorkspaceMoney {
    val amount = json.opt("amountMinor") as? Number ?: error("Nantty returned an invalid ad amount.")
    val minor = runCatching { BigDecimal(amount.toString()).longValueExact() }.getOrNull()?.takeIf { it >= 0 }
        ?: error("Nantty returned an invalid ad amount.")
    val currency = json.optString("currency").takeIf { it.matches(Regex("[A-Z]{3}")) }
        ?: error("Nantty returned an invalid ad currency.")
    return AdsWorkspaceMoney(minor, currency)
}

private fun parseAudience(json: JSONObject): AdsCampaignAudience {
    val mode = json.optString("mode")
    if (mode == "automatic") return AdsCampaignAudience()
    require(mode == "custom") { "Nantty returned an invalid ad audience." }
    return AdsCampaignAudience(
        mode = mode,
        countryCode = json.optString("countryCode"),
        states = json.optJSONArray("states")?.stringValues().orEmpty(),
        interests = json.optJSONArray("interests")?.stringValues().orEmpty(),
        ageMin = json.optInt("ageMin"),
        ageMax = json.optInt("ageMax"),
        gender = json.optString("gender").ifBlank { "all" },
        topicIds = json.optJSONArray("topicIds")?.stringValues().orEmpty(),
    )
}

private fun destinationLabel(type: String) = when (type) {
    "post" -> "Post"
    "profile" -> "Your profile"
    "store" -> "Your store"
    "product" -> "Product"
    else -> "Promotion"
}

private fun JSONObject.campaignData(): JSONObject = optJSONObject("data") ?: this
private fun JSONObject.campaignRows(): JSONArray {
    val data = campaignData()
    return (data.optJSONArray("data") ?: data.optJSONArray("items") ?: data.optJSONArray("locations") ?: data.optJSONArray("topics"))
        ?: error("Nantty returned an incomplete targeting catalogue.")
}
private fun JSONObject.requiredNonNegativeLong(key: String): Long {
    val value = opt(key) as? Number ?: error("Nantty returned an incomplete ad estimate.")
    return runCatching { BigDecimal(value.toString()).longValueExact() }.getOrNull()?.takeIf { it >= 0 }
        ?: error("Nantty returned an invalid ad estimate.")
}
private fun JSONArray.stringValues(): List<String> = (0 until length()).mapNotNull { index -> optString(index).takeIf(String::isNotBlank) }
private fun JSONArray.parseMoneyArray(): List<AdsWorkspaceMoney> = (0 until length()).map { index -> parseMoney(optJSONObject(index) ?: error("Nantty returned invalid ad options.")) }
private fun encodeAdsCampaignQuery(value: String) = URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20")

private val ADS_IDEMPOTENCY_PATTERN = Regex("^[A-Za-z0-9_-]{8,128}$")
