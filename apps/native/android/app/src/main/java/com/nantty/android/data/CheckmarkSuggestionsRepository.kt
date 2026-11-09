package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/** Data source for the React Native Get Verified feed contracts (not the identity-check journey). */
class CheckmarkSuggestionsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CheckmarkSuggestionsTransport = JdkCheckmarkSuggestionsTransport(baseUrl),
) {
    fun loadSuggestions(): CheckmarkSuggestionsResult<List<CheckmarkSuggestion>> = requestResult {
        val response = authenticated { token -> transport.get(SUGGESTIONS_PATH, token) }
        parseCheckmarkSuggestions(response)
    }

    fun loadPlans(): CheckmarkSuggestionsResult<List<CheckmarkVerificationPlan>> = requestResult {
        val response = authenticated { token -> transport.get(PLANS_PATH, token) }
        parseCheckmarkVerificationPlans(response)
    }

    fun loadMyVerification(): CheckmarkSuggestionsResult<CheckmarkMyVerification> = requestResult {
        val response = authenticated { token -> transport.get(MY_VERIFICATION_PATH, token) }
        parseCheckmarkMyVerification(response)
    }

    fun loadDiscounts(): CheckmarkSuggestionsResult<CheckmarkVerificationDiscounts> = requestResult {
        val response = authenticated { token -> transport.get(DISCOUNTS_PATH, token) }
        parseCheckmarkVerificationDiscounts(response)
    }

    fun dismissSuggestion(color: String): CheckmarkSuggestionsResult<Unit> = requestResult {
        require(color == BLUE_COLOR || color == GOLD_COLOR) { "That checkmark suggestion does not exist." }
        authenticated { token -> transport.post("$SUGGESTIONS_PATH/$color/dismiss", token) }
        Unit
    }

    private fun <T> requestResult(block: () -> T): CheckmarkSuggestionsResult<T> = try {
        CheckmarkSuggestionsResult.Success(block())
    } catch (error: CheckmarkSuggestionsHttpException) {
        CheckmarkSuggestionsResult.Failure(
            error.message ?: "Verification information could not be loaded. Try again.",
            authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
        )
    } catch (error: Exception) {
        CheckmarkSuggestionsResult.Failure(error.message ?: "Verification information could not be loaded. Check your connection and try again.")
    }

    private fun <T> authenticated(block: (String) -> T): T {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: throw CheckmarkSuggestionsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to view verification suggestions.")
        return try {
            block(session.accessToken)
        } catch (error: CheckmarkSuggestionsHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw CheckmarkSuggestionsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
            block(refreshedToken)
        }
    }

    companion object {
        const val SUGGESTIONS_PATH = "/api/v1/verification/suggestions"
        const val PLANS_PATH = "/api/v1/verification/plans"
        const val MY_VERIFICATION_PATH = "/api/v1/verification/me"
        const val DISCOUNTS_PATH = "/api/v1/verification/discounts"
        private const val BLUE_COLOR = "blue"
        private const val GOLD_COLOR = "gold"
    }
}

interface CheckmarkSuggestionsTransport {
    fun get(path: String, accessToken: String): String
    fun post(path: String, accessToken: String): String
}

internal class JdkCheckmarkSuggestionsTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : CheckmarkSuggestionsTransport {
    override fun get(path: String, accessToken: String): String = execute("GET", path, accessToken)
    override fun post(path: String, accessToken: String): String = execute("POST", path, accessToken)

    private fun execute(method: String, path: String, accessToken: String): String {
        require(accessToken.isNotBlank()) { "Sign in to view verification suggestions." }
        require(
            (method == "GET" && path in ALLOWED_GET_PATHS) || (method == "POST" && path.matches(DISMISS_PATH)),
        ) { "Unsupported verification suggestions request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view verification suggestions.")
        val connection = openConnection(URI(origin + path).toURL()).apply {
            requestMethod = method
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            val status = connection.responseCode
            if (status == HttpURLConnection.HTTP_NO_CONTENT && method == "POST") return ""
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.use(::readBoundedCheckmarkResponse).orEmpty()
            if (status !in 200..299) throw CheckmarkSuggestionsHttpException(status, parseCheckmarkApiError(body, status))
            if (body.isBlank()) error("Nantty returned an empty verification response.")
            return body
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedCheckmarkResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large verification response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 15_000
        const val MAX_RESPONSE_BYTES = 1_048_576
        val ALLOWED_GET_PATHS = setOf(
            CheckmarkSuggestionsRepository.SUGGESTIONS_PATH,
            CheckmarkSuggestionsRepository.PLANS_PATH,
            CheckmarkSuggestionsRepository.MY_VERIFICATION_PATH,
            CheckmarkSuggestionsRepository.DISCOUNTS_PATH,
        )
        val DISMISS_PATH = Regex("^/api/v1/verification/suggestions/(blue|gold)/dismiss$")
    }
}

internal class CheckmarkSuggestionsHttpException(val statusCode: Int, message: String? = null) :
    Exception(message ?: "Verification request failed (HTTP $statusCode).")

internal fun parseCheckmarkSuggestions(response: String): List<CheckmarkSuggestion> {
    val root = parseCheckmarkJsonValue(response)
    val rows = when (root) {
        is JSONArray -> root
        is JSONObject -> root.optJSONArray("data") ?: error("Nantty returned an invalid suggestions response.")
        else -> error("Nantty returned an invalid suggestions response.")
    }
    return buildList(rows.length()) {
        for (index in 0 until rows.length()) add(parseCheckmarkSuggestion(rows.getJSONObject(index)))
    }
}

internal fun parseCheckmarkVerificationPlans(response: String): List<CheckmarkVerificationPlan> {
    val root = parseCheckmarkJsonValue(response)
    val rows = when (root) {
        is JSONArray -> root
        is JSONObject -> root.optJSONArray("data") ?: error("Nantty returned an invalid verification plans response.")
        else -> error("Nantty returned an invalid verification plans response.")
    }
    return buildList(rows.length()) {
        for (index in 0 until rows.length()) {
            val row = rows.getJSONObject(index)
            val price = row.optJSONObject("price") ?: error("Nantty returned incomplete verification plan data.")
            val perks = row.optJSONArray("perks") ?: error("Nantty returned incomplete verification plan data.")
            add(
                CheckmarkVerificationPlan(
                    id = row.requiredString("id"),
                    planCode = row.requiredString("planCode"),
                    name = row.requiredString("name"),
                    color = row.requiredString("color"),
                    tier = row.requiredString("tier"),
                    price = CheckmarkDiscountMoney(price.requiredLong("amountMinor"), price.requiredString("currency")),
                    interval = row.requiredString("interval"),
                    channel = row.requiredString("channel"),
                    storeProductId = row.optNullableStringStrict("storeProductId"),
                    perks = buildList(perks.length()) {
                        for (perkIndex in 0 until perks.length()) {
                            val perk = perks.getJSONObject(perkIndex)
                            add(CheckmarkVerificationPerk(perk.requiredString("title"), perk.optNullableStringStrict("description").orEmpty()))
                        }
                    },
                ),
            )
        }
    }
}

internal fun parseCheckmarkMyVerification(response: String): CheckmarkMyVerification {
    val root = JSONObject(response).checkmarkDataObject()
    return CheckmarkMyVerification(
        current = root.optNullableObject("current")?.let(::parseCheckmarkCurrent),
        subscription = root.optNullableObject("subscription")?.let(::parseCheckmarkSubscription),
        application = root.optNullableObject("application")?.let(::parseCheckmarkApplication),
        handleReserved = root.optBooleanStrict("handleReserved", default = false),
        reverificationDueAt = root.optNullableStringStrict("reverificationDueAt"),
    )
}

internal fun parseCheckmarkVerificationDiscounts(response: String): CheckmarkVerificationDiscounts {
    val root = JSONObject(response).checkmarkDataObject()
    val offers = root.optJSONArray("offers") ?: error("Nantty returned invalid verification discounts.")
    val bundle = root.opt("bundle").let { value ->
        when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> CheckmarkBundleDiscount(value.requiredLong("percentOff"))
            else -> error("Nantty returned invalid bundle discount data.")
        }
    }
    return CheckmarkVerificationDiscounts(
        offers = buildList(offers.length()) {
            for (index in 0 until offers.length()) add(parseCheckmarkOffer(offers.getJSONObject(index)))
        },
        yearlyPercentOff = root.requiredLong("yearlyPercentOff"),
        bundle = bundle,
    )
}

private fun parseCheckmarkSuggestion(root: JSONObject): CheckmarkSuggestion {
    val rules = root.optJSONArray("rules") ?: error("Nantty returned an invalid checkmark rule list.")
    return CheckmarkSuggestion(
        color = root.requiredString("color"),
        eligible = root.requiredBoolean("eligible"),
        dismissed = root.requiredBoolean("dismissed"),
        headline = root.requiredString("headline"),
        detail = root.requiredString("detail"),
        rules = buildList(rules.length()) {
            for (index in 0 until rules.length()) {
                val rule = rules.getJSONObject(index)
                add(CheckmarkSuggestionRule(rule.requiredString("label"), rule.requiredBoolean("met")))
            }
        },
    )
}

private fun parseCheckmarkCurrent(root: JSONObject) = CheckmarkVerificationCurrent(
    status = root.requiredString("status"),
    type = root.requiredString("type"),
    color = root.requiredString("color"),
    tier = root.requiredString("tier"),
    badgeVisible = root.requiredBoolean("badgeVisible"),
    graceEndsAt = root.optNullableStringStrict("graceEndsAt"),
)

private fun parseCheckmarkApplication(root: JSONObject) = CheckmarkVerificationApplication(
    id = root.requiredString("id"),
    color = root.requiredString("color"),
    status = root.requiredString("status"),
    submittedAt = root.requiredString("submittedAt"),
    rejectionReason = root.optNullableStringStrict("rejectionReason"),
)

private fun parseCheckmarkSubscription(root: JSONObject) = CheckmarkVerificationSubscription(
    planId = root.requiredString("planId"),
    status = root.requiredString("status"),
    renewsAt = root.optNullableStringStrict("renewsAt"),
    cancelAtPeriodEnd = root.requiredBoolean("cancelAtPeriodEnd"),
)

private fun parseCheckmarkOffer(root: JSONObject): CheckmarkOfferDiscount {
    val plans = root.optJSONArray("plans") ?: error("Nantty returned invalid verification offer plans.")
    val terms = root.optJSONObject("discount") ?: error("Nantty returned invalid verification offer terms.")
    val amountOff = terms.opt("amountOff").let { value ->
        when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> CheckmarkDiscountMoney(value.requiredLong("amountMinor"), value.requiredString("currency"))
            else -> error("Nantty returned invalid verification discount money.")
        }
    }
    return CheckmarkOfferDiscount(
        linkId = root.requiredString("linkId"),
        token = root.requiredString("token"),
        plans = buildList(plans.length()) {
            for (index in 0 until plans.length()) {
                val plan = plans.getJSONObject(index)
                add(CheckmarkOfferPlan(plan.requiredString("planCode"), plan.requiredString("planLabel")))
            }
        },
        discount = CheckmarkOfferDiscountTerms(
            kind = terms.requiredString("kind"),
            percentOff = terms.optNullableLong("percentOff"),
            amountOff = amountOff,
        ),
        durationCycles = root.requiredInt("durationCycles"),
        expiresAt = root.optNullableStringStrict("expiresAt"),
        sentAt = root.requiredString("sentAt"),
    )
}

private fun JSONObject.checkmarkDataObject(): JSONObject = optJSONObject("data") ?: this

private fun parseCheckmarkJsonValue(response: String): Any {
    val tokener = JSONTokener(response)
    val value = tokener.nextValue()
    require(tokener.nextClean() == '\u0000') { "Nantty returned malformed verification JSON." }
    return value
}

private fun JSONObject.optNullableObject(key: String): JSONObject? = when (val value = opt(key)) {
    null, JSONObject.NULL -> null
    is JSONObject -> value
    else -> error("Nantty returned invalid verification data.")
}

private fun JSONObject.requiredString(key: String): String =
    (opt(key) as? String)?.takeIf(String::isNotBlank) ?: error("Nantty returned incomplete verification data.")

private fun JSONObject.optNullableStringStrict(key: String): String? = when (val value = opt(key)) {
    null, JSONObject.NULL -> null
    is String -> value.takeIf(String::isNotBlank)
    else -> error("Nantty returned invalid verification data.")
}

private fun JSONObject.requiredBoolean(key: String): Boolean = when (val value = opt(key)) {
    is Boolean -> value
    else -> error("Nantty returned incomplete verification data.")
}

private fun JSONObject.optBooleanStrict(key: String, default: Boolean): Boolean = when (val value = opt(key)) {
    null, JSONObject.NULL -> default
    is Boolean -> value
    else -> error("Nantty returned invalid verification data.")
}

private fun JSONObject.requiredLong(key: String): Long = optNullableLong(key)
    ?: error("Nantty returned incomplete verification data.")

private fun JSONObject.optNullableLong(key: String): Long? = when (val value = opt(key)) {
    null, JSONObject.NULL -> null
    is Byte, is Short, is Int, is Long -> (value as Number).toLong()
    is Number -> value.toString().toLongOrNull()
    else -> error("Nantty returned invalid verification data.")
}

private fun JSONObject.requiredInt(key: String): Int {
    val value = requiredLong(key)
    return value.toInt().also { require(it.toLong() == value) { "Nantty returned invalid verification data." } }
}

private fun parseCheckmarkApiError(response: String, status: Int): String = runCatching {
    val root = JSONObject(response).checkmarkDataObject()
    val error = root.optJSONObject("error")
    (error?.opt("message") as? String)?.takeIf(String::isNotBlank)
        ?: (root.opt("message") as? String)?.takeIf(String::isNotBlank)
        ?: "Verification request failed (HTTP $status)."
}.getOrDefault("Verification request failed (HTTP $status).")
