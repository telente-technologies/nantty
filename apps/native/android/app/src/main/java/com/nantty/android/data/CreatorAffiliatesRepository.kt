package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

internal data class AffiliateMoney(val amountMinor: Long, val currency: String)
internal data class AffiliateStore(val id: String, val name: String, val logoUrl: String?)
internal data class AffiliateProgrammeTerms(
    val attributionWindowDays: Int,
    val approval: String,
    val commissionPaidWhen: String,
)
internal data class AffiliateLink(val id: String, val productId: String, val clicks: Long)
internal data class PromotableAffiliateProduct(
    val productId: String,
    val name: String,
    val imageUrl: String?,
    val price: AffiliateMoney,
    val stock: Long?,
    val store: AffiliateStore,
    val commissionPercent: Double,
    val estimatedCommission: AffiliateMoney,
    val access: String,
    val link: AffiliateLink?,
    val programme: AffiliateProgrammeTerms,
)
internal data class AffiliatePromotion(
    val productId: String,
    val name: String,
    val imageUrl: String?,
    val store: AffiliateStore,
    val commissionPercent: Double,
    val access: String,
    val link: AffiliateLink?,
    val clicks: Long,
    val pendingOrders: Int,
    val completedOrders: Int,
    val reversedOrders: Int,
    val conversionPercent: Double?,
    val earned: AffiliateMoney,
    val pendingEarnings: AffiliateMoney,
)
internal data class AffiliateEarning(
    val id: String,
    val status: String,
    val payoutStatus: String,
    val reason: String,
    val orderNumber: String,
    val productName: String,
    val storeName: String,
    val sale: AffiliateMoney,
    val commissionPercent: Double,
    val commission: AffiliateMoney,
    val reversed: AffiliateMoney,
)
internal data class AffiliateEarningsSummary(
    val pending: List<AffiliateMoney>,
    val earned: List<AffiliateMoney>,
    val paid: List<AffiliateMoney>,
    val reversed: List<AffiliateMoney>,
)
internal data class AffiliateEarningsPage(
    val summary: AffiliateEarningsSummary,
    val data: List<AffiliateEarning>,
    val nextCursor: String?,
)

internal sealed interface CreatorAffiliatesResult<out T> {
    data class Success<T>(val value: T) : CreatorAffiliatesResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CreatorAffiliatesResult<Nothing>
}

internal data class CreatorAffiliatesResponse(val status: Int, val body: String)
internal fun interface CreatorAffiliatesTransport {
    fun request(method: String, path: String, token: String, body: JSONObject?): CreatorAffiliatesResponse
}

/** Creator affiliate catalogue and settlement reads use the same server-owned programme and commission rules as RN. */
internal class CreatorAffiliatesRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CreatorAffiliatesTransport = JdkCreatorAffiliatesTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun listCatalog(search: String, cursor: String?): CreatorAffiliatesResult<AffiliateCatalogPage> {
        val query = search.trim().take(80)
        val path = buildAffiliateCatalogPath(query, cursor)
        return request("load affiliate products", "GET", path) { root ->
            AffiliateCatalogPage(root.requireAffiliateRows().mapNotNull { row -> runCatching { row.toPromotableAffiliateProduct() }.getOrNull() }, root.optStringOrNull("nextCursor"))
        }
    }

    fun listPromotions(): CreatorAffiliatesResult<List<AffiliatePromotion>> =
        request("load promoted products", "GET", PROMOTIONS_PATH) { root ->
            root.requireAffiliateRows().mapNotNull { row -> runCatching { row.toAffiliatePromotion() }.getOrNull() }
        }

    fun listEarnings(status: String, cursor: String?): CreatorAffiliatesResult<AffiliateEarningsPage> {
        if (status !in EARNING_STATUSES) return CreatorAffiliatesResult.Failure("Choose a valid commission status.")
        return request("load affiliate commissions", "GET", buildAffiliateEarningsPath(status, cursor)) { root -> root.toAffiliateEarningsPage() }
    }

    fun createLink(productId: String): CreatorAffiliatesResult<AffiliateLink> {
        if (!isSafeMartIdentifier(productId)) return CreatorAffiliatesResult.Failure("This product link is invalid.")
        return request("create an affiliate link", "POST", LINKS_PATH, JSONObject().put("productId", productId)) { root ->
            (root.optJSONObject("data") ?: root).toAffiliateLink()
        }
    }

    fun requestToPromote(productId: String): CreatorAffiliatesResult<Unit> {
        if (!isSafeMartIdentifier(productId)) return CreatorAffiliatesResult.Failure("This product is invalid.")
        return request("request product approval", "POST", AFFILIATIONS_PATH, JSONObject().put("productId", productId)) { Unit }
    }

    private fun <T> request(
        action: String,
        method: String,
        path: String,
        body: JSONObject? = null,
        parse: (JSONObject) -> T,
    ): CreatorAffiliatesResult<T> {
        var token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return CreatorAffiliatesResult.Failure("Sign in to $action.", authenticationRequired = true)
        return try {
            var response = transport.request(method, path, token, body)
            if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED) {
                token = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                    ?: return CreatorAffiliatesResult.Failure("Your session expired. Sign in again to $action.", true)
                response = transport.request(method, path, token, body)
            }
            if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED || response.status == HttpURLConnection.HTTP_FORBIDDEN) {
                return CreatorAffiliatesResult.Failure("Your session expired. Sign in again to $action.", true)
            }
            if (response.status !in 200..299) return CreatorAffiliatesResult.Failure("Could not $action. Please try again.")
            val root = JSONObject(response.body)
            val payload = root.optJSONObject("data") ?: root
            CreatorAffiliatesResult.Success(parse(payload))
        } catch (_: Exception) {
            CreatorAffiliatesResult.Failure("Could not $action. Check your connection and try again.")
        }
    }

    companion object {
        const val PROMOTIONS_PATH = "/api/v1/creators/me/affiliate-promotions"
        const val LINKS_PATH = "/api/v1/creators/me/affiliate-links"
        const val AFFILIATIONS_PATH = "/api/v1/creators/affiliations"
        val EARNING_STATUSES = setOf("pending", "earned", "reversed")
    }
}

internal data class AffiliateCatalogPage(val data: List<PromotableAffiliateProduct>, val nextCursor: String?)

internal fun buildAffiliateCatalogPath(search: String, cursor: String?): String {
    require(search.length <= 80)
    require(cursor == null || cursor.length <= 200 && cursor.none(Char::isISOControl))
    return buildString {
        append("/api/v1/creators/me/affiliate-catalog?sort=commission&limit=24")
        if (search.isNotBlank()) append("&q=${URLEncoder.encode(search, Charsets.UTF_8.name())}")
        cursor?.let { append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}") }
    }
}

internal fun buildAffiliateEarningsPath(status: String, cursor: String?): String {
    require(status in CreatorAffiliatesRepository.EARNING_STATUSES)
    require(cursor == null || cursor.length <= 200 && cursor.none(Char::isISOControl))
    return buildString {
        append("/api/v1/creators/me/affiliate-earnings?status=$status&limit=20")
        cursor?.let { append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}") }
    }
}

private fun JSONObject.toPromotableAffiliateProduct(): PromotableAffiliateProduct {
    val productId = requiredAffiliateString("productId")
    require(isSafeMartIdentifier(productId))
    return PromotableAffiliateProduct(
        productId = productId,
        name = requiredAffiliateString("name"),
        imageUrl = safeAffiliateImage(optStringOrNull("imageUrl")),
        price = getJSONObject("price").toAffiliateMoney(),
        stock = optNullableLong("stock"),
        store = getJSONObject("store").toAffiliateStore(),
        commissionPercent = requiredAffiliatePercent("commissionPercent"),
        estimatedCommission = getJSONObject("estimatedCommission").toAffiliateMoney(),
        access = requiredAffiliateAccess(),
        link = optJSONObject("link")?.toAffiliateLink(),
        programme = getJSONObject("programme").toAffiliateProgrammeTerms(),
    )
}

private fun JSONObject.toAffiliatePromotion(): AffiliatePromotion {
    val productId = requiredAffiliateString("productId")
    require(isSafeMartIdentifier(productId))
    return AffiliatePromotion(
        productId, requiredAffiliateString("name"), safeAffiliateImage(optStringOrNull("imageUrl")), getJSONObject("store").toAffiliateStore(),
        requiredAffiliatePercent("commissionPercent"), requiredAffiliateAccess(), optJSONObject("link")?.toAffiliateLink(),
        nonNegativeLong("clicks"), nonNegativeInt("pendingOrders"), nonNegativeInt("completedOrders"), nonNegativeInt("reversedOrders"),
        optNumberOrNull("conversionPercent")?.takeIf { it.isFinite() && it in 0.0..100.0 },
        getJSONObject("earned").toAffiliateMoney(), getJSONObject("pendingEarnings").toAffiliateMoney(),
    )
}

private fun JSONObject.toAffiliateEarningsPage(): AffiliateEarningsPage {
    val summary = getJSONObject("summary")
    return AffiliateEarningsPage(
        AffiliateEarningsSummary(summary.moneyList("pending"), summary.moneyList("earned"), summary.moneyList("paid"), summary.moneyList("reversed")),
        requireAffiliateRows().mapNotNull { row -> runCatching { row.toAffiliateEarning() }.getOrNull() },
        optStringOrNull("nextCursor"),
    )
}

private fun JSONObject.toAffiliateEarning(): AffiliateEarning {
    val id = requiredAffiliateString("id")
    require(isSafeMartIdentifier(id))
    val status = requiredAffiliateString("status")
    require(status in CreatorAffiliatesRepository.EARNING_STATUSES)
    val product = getJSONObject("product")
    val store = getJSONObject("store")
    return AffiliateEarning(
        id, status, requiredAffiliateString("payoutStatus"), optStringOrNull("reason").orEmpty(), optStringOrNull("orderNumber").orEmpty(),
        product.optString("name", "Product"), store.optString("name", "Store"), getJSONObject("sale").toAffiliateMoney(),
        requiredAffiliatePercent("commissionPercent"), getJSONObject("commission").toAffiliateMoney(), getJSONObject("reversed").toAffiliateMoney(),
    )
}

private fun JSONObject.toAffiliateLink(): AffiliateLink {
    val id = requiredAffiliateString("id")
    val productId = requiredAffiliateString("productId")
    require(isSafeMartIdentifier(id) && isSafeMartIdentifier(productId))
    return AffiliateLink(id, productId, nonNegativeLong("clicks"))
}

private fun JSONObject.toAffiliateStore(): AffiliateStore {
    val id = requiredAffiliateString("id")
    return AffiliateStore(id, optString("name", "Store"), safeAffiliateImage(optStringOrNull("logoUrl")))
}

private fun JSONObject.toAffiliateProgrammeTerms(): AffiliateProgrammeTerms {
    val days = optInt("attributionWindowDays", 0)
    require(days in 1..365)
    val approval = requiredAffiliateString("approval")
    require(approval == "automatic" || approval == "manual")
    val paidWhen = requiredAffiliateString("commissionPaidWhen")
    require(paidWhen == "order_completed")
    return AffiliateProgrammeTerms(days, approval, paidWhen)
}

private fun JSONObject.toAffiliateMoney(): AffiliateMoney {
    val amount = opt("amountMinor") as? Number ?: error("Invalid currency amount")
    val minor = amount.toLong()
    require(amount.toDouble() == minor.toDouble() && minor >= 0)
    val currency = requiredAffiliateString("currency")
    require(currency.matches(Regex("[A-Z]{3}")))
    return AffiliateMoney(minor, currency)
}

private fun JSONObject.requiredAffiliateAccess(): String = requiredAffiliateString("access").also {
    require(it in AFFILIATE_ACCESS_VALUES)
}

private fun JSONObject.requiredAffiliatePercent(key: String): Double {
    val value = opt(key) as? Number ?: error("Invalid commission")
    val percent = value.toDouble()
    require(percent.isFinite() && percent in 0.0..100.0)
    return percent
}

private fun JSONObject.moneyList(key: String): List<AffiliateMoney> {
    val rows = optJSONArray(key) ?: return emptyList()
    return buildList { for (index in 0 until rows.length()) rows.optJSONObject(index)?.let { row -> runCatching { row.toAffiliateMoney() }.getOrNull()?.let(::add) } }
}

private fun JSONObject.requireAffiliateRows(): List<JSONObject> {
    val rows = optJSONArray("data") ?: error("Nantty returned an incomplete affiliate response")
    return buildList { for (index in 0 until rows.length()) rows.optJSONObject(index)?.let(::add) }
}

private fun JSONObject.requiredAffiliateString(key: String): String =
    (opt(key) as? String)?.trim()?.takeIf(String::isNotEmpty) ?: error("Invalid affiliate response")

private fun JSONObject.optStringOrNull(key: String): String? =
    (opt(key) as? String)?.trim()?.takeIf { it.isNotEmpty() && it != "null" }

private fun JSONObject.optNullableLong(key: String): Long? {
    if (isNull(key)) return null
    val value = opt(key) as? Number ?: return null
    return value.toLong().takeIf { value.toDouble() == it.toDouble() && it >= 0 }
}

private fun JSONObject.nonNegativeLong(key: String): Long = optNullableLong(key) ?: 0L
private fun JSONObject.nonNegativeInt(key: String): Int = nonNegativeLong(key).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
private fun JSONObject.optNumberOrNull(key: String): Double? = (opt(key) as? Number)?.toDouble()
private fun safeAffiliateImage(value: String?): String? = value?.takeIf { isSafeSellerCatalogImageUrl(it) }

private val AFFILIATE_ACCESS_VALUES = setOf("approved", "paused", "requested", "open", "approval_required", "closed")

private class JdkCreatorAffiliatesTransport(baseUrl: String) : CreatorAffiliatesTransport {
    private val origin = runCatching { java.net.URL(baseUrl.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid Nantty API URL.", it) }

    override fun request(method: String, path: String, token: String, body: JSONObject?): CreatorAffiliatesResponse {
        val allowed = path.matches(Regex("^/api/v1/creators/me/affiliate-catalog\\?sort=commission&limit=24(?:&q=[^\\r\\n]{0,300})?(?:&cursor=[^\\r\\n]{0,600})?$")) ||
            path == CreatorAffiliatesRepository.PROMOTIONS_PATH || path == CreatorAffiliatesRepository.LINKS_PATH || path == CreatorAffiliatesRepository.AFFILIATIONS_PATH ||
            path.matches(Regex("^/api/v1/creators/me/affiliate-earnings\\?status=(pending|earned|reversed)&limit=20(?:&cursor=[^\\r\\n]{0,600})?$"))
        require(allowed) { "Unsupported creator affiliate request." }
        require(origin.protocol == "https" || origin.protocol == "http" && origin.host == "10.0.2.2")
        require((method == "GET" && body == null) || (method == "POST" && body != null && path in setOf(CreatorAffiliatesRepository.LINKS_PATH, CreatorAffiliatesRepository.AFFILIATIONS_PATH)))
        val connection = (URL(origin.toString().trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        return try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8 * 1024)
                var total = 0
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    require(total <= MAX_AFFILIATE_RESPONSE_BYTES) { "Affiliate response was too large." }
                    output.write(buffer, 0, read)
                }
                val bytes = output.toByteArray()
                require(bytes.size <= MAX_AFFILIATE_RESPONSE_BYTES) { "Affiliate response was too large." }
                bytes.toString(Charsets.UTF_8)
            }.orEmpty()
            CreatorAffiliatesResponse(status, response)
        } finally {
            connection.disconnect()
        }
    }
}

private const val MAX_AFFILIATE_RESPONSE_BYTES = 1_000_000
