package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.io.ByteArrayOutputStream
import java.io.InputStream
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class MartCategory(val id: String, val name: String, val depth: Int)
data class MartProduct(val id: String, val name: String, val amountMinor: Long, val currency: String, val imageUrl: String?, val stock: Int)
data class MartStoreSummary(
    val id: String,
    val name: String,
    val logoUrl: String?,
    val rating: Double,
    val ratingCount: Int,
    val reviewCount: Int,
    val isFollowing: Boolean = false,
)
data class MartProductVariant(
    val id: String,
    val title: String,
    val priceMinor: Long,
    val currency: String,
    val inStock: Boolean,
    val size: String = "",
    val color: String = "",
    val optionValues: Map<String, String> = emptyMap(),
)
data class MartProductDetail(
    val id: String,
    val title: String,
    val amountMinor: Long,
    val currency: String,
    val stock: Int,
    val images: List<String>,
    val rating: Double,
    val promo: String?,
    val sizes: List<String>,
    val colors: List<String>,
    val shippingInfo: String,
    val description: String,
    val store: MartStoreSummary,
    val variants: List<MartProductVariant>,
)
data class MartPage(val products: List<MartProduct>, val nextCursor: String?)
data class MartHome(
    val categories: List<MartCategory>,
    val salesOfTheDayImageUrl: String? = null,
    val featuredBrandsImageUrl: String? = null,
    val newArrivalsImageUrl: String? = null,
)
sealed interface MartHighlightTarget {
    data class Product(val productId: String, val name: String) : MartHighlightTarget
    data class Collection(val collection: String, val name: String) : MartHighlightTarget
    data class Category(val categoryId: String, val name: String) : MartHighlightTarget
}
data class MartSponsoredPlacement(
    val campaignId: String,
    val label: String,
    val advertiserName: String,
    val impressionToken: String,
)
data class MartHighlight(
    val id: String,
    val kind: String,
    val title: String,
    val subtitle: String?,
    val imageUrl: String?,
    val target: MartHighlightTarget,
    val reasonLabel: String,
    val sponsored: MartSponsoredPlacement?,
)

sealed interface MartResult {
    data class Home(val value: MartHome) : MartResult
    data class Products(val value: MartPage) : MartResult
    data class Highlights(val value: List<MartHighlight>) : MartResult
    data class Failure(val message: String) : MartResult
}

sealed interface MartProductDetailResult {
    data class Success(val value: MartProductDetail) : MartProductDetailResult
    data class Failure(val message: String) : MartProductDetailResult
}

class MartRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String? = { null },
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    private val interactionRepository by lazy { ProductInteractionRepository(baseUrl, accessTokenProvider, openConnection) }

    internal fun currentAccessToken(): String? = accessTokenProvider()

    fun recordCategoryViewed(categoryId: String): Boolean = interactionRepository.recordCategoryViewed(categoryId)

    fun recordProductClicked(productId: String): Boolean = interactionRepository.recordProductClicked(productId)

    fun loadHome(): MartResult = get(buildMartHomeUrl(baseUrl), ::parseHome)

    fun loadHighlights(limit: Int = MART_HIGHLIGHTS_PAGE_SIZE): MartResult {
        if (limit !in 1..MART_HIGHLIGHTS_PAGE_SIZE) return MartResult.Failure("The Mart highlights request is invalid.")
        return get(buildMartHighlightsUrl(baseUrl, limit), ::parseHighlights)
    }

    fun recordSponsoredEvent(placement: MartSponsoredPlacement, itemId: String, type: String): Boolean {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return false
        if (type !in setOf("impression", "click") || !isSafeMartIdentifier(itemId)) return false
        return try {
            val connection = openConnection(buildMartAdsEventsUrl(baseUrl)).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }
            connection.useConnection {
                val payload = JSONObject().put(
                    "events",
                    JSONArray().put(
                        JSONObject()
                            .put("campaignId", placement.campaignId)
                            .put("placement", "mart")
                            .put("type", type)
                            .put("itemId", itemId)
                            .put("token", placement.impressionToken)
                            .put("occurredAt", java.time.Instant.now().toString()),
                    ),
                )
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                connection.responseCode in 200..299
            }
        } catch (_: Exception) {
            false
        }
    }

    fun loadProducts(categoryId: String? = null, cursor: String? = null, collection: String? = null): MartResult {
        if (categoryId != null && !isSafeMartIdentifier(categoryId)) return MartResult.Failure("Nantty returned an invalid category. Refresh the Mart and try again.")
        if (cursor != null && cursor.length > 300) return MartResult.Failure("The product page cursor is invalid. Refresh the Mart and try again.")
        if (collection != null && collection !in MART_PRODUCT_COLLECTIONS) return MartResult.Failure("This Mart collection is not available.")
        if (collection != null && categoryId != null) return MartResult.Failure("Choose a category or a collection, not both.")
        return get(buildMartProductsUrl(baseUrl, categoryId, cursor, collection), ::parseProducts)
    }

    fun loadProductDetail(productId: String): MartProductDetailResult {
        if (!isSafeMartIdentifier(productId)) return MartProductDetailResult.Failure("This product link is invalid.")
        return try {
            val connection = openConnection(buildMartProductDetailUrl(baseUrl, productId)).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                accessTokenProvider()?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.use(::readBoundedResponse).orEmpty()
                if (status !in 200..299) MartProductDetailResult.Failure("Product request failed (HTTP $status). Please try again later.")
                else runCatching { MartProductDetailResult.Success(parseProductDetail(body, productId)) }
                    .getOrElse { MartProductDetailResult.Failure("Nantty returned product details that could not be read.") }
            }
        } catch (_: Exception) {
            MartProductDetailResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    private fun get(url: URL, parse: (String) -> MartResult): MartResult {
        return try {
            val connection = openConnection(url)
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                accessTokenProvider()?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.use(::readBoundedResponse).orEmpty()
                if (status !in 200..299) MartResult.Failure("Mart request failed (HTTP $status). Please try again later.")
                else runCatching { parse(body) }.getOrElse { MartResult.Failure("Nantty returned catalogue data that could not be read.") }
            }
        } catch (_: Exception) {
            MartResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    private fun parseHome(body: String): MartResult.Home {
        val root = JSONObject(body)
        val rows = root.optJSONArray("categories") ?: JSONArray()
        val categories = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                if (isSafeMartIdentifier(id) && name.isNotEmpty()) add(MartCategory(id, name, item.optInt("depth").coerceAtLeast(0)))
            }
        }
        return MartResult.Home(
            MartHome(
                categories = categories,
                salesOfTheDayImageUrl = safeMediaUrl(root.optNullableString("salesOfTheDayImageUrl")),
                featuredBrandsImageUrl = safeMediaUrl(root.optNullableString("featuredBrandsImageUrl")),
                newArrivalsImageUrl = safeMediaUrl(root.optNullableString("newArrivalsImageUrl")),
            ),
        )
    }

    private fun parseProducts(body: String): MartResult.Products {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val products = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                val price = item.optJSONObject("price") ?: continue
                val amount = price.optLong("amountMinor", -1)
                val currency = price.optString("currency")
                if (!isSafeMartIdentifier(id) || name.isEmpty() || amount < 0 || !currency.matches(Regex("[A-Z]{3}"))) continue
                add(MartProduct(
                    id = id,
                    name = name,
                    amountMinor = amount,
                    currency = currency,
                    imageUrl = safeMediaUrl(item.optString("imageUrl").takeUnless { it.isBlank() || it == "null" }),
                    stock = item.optInt("stock").coerceAtLeast(0),
                ))
            }
        }
        return MartResult.Products(MartPage(products, root.optString("nextCursor").takeUnless { it.isBlank() || it == "null" }))
    }

    private fun parseHighlights(body: String): MartResult.Highlights {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val highlights = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val title = row.optString("title").trim()
                val kind = row.optString("kind").trim()
                val targetJson = row.optJSONObject("target") ?: continue
                if (!isSafeMartIdentifier(id) || title.isEmpty() || kind.isEmpty()) continue
                val targetName = targetJson.optString("name").trim()
                if (targetName.isEmpty()) continue
                val target = when (targetJson.optString("type")) {
                    "product" -> targetJson.optString("productId").takeIf(::isSafeMartIdentifier)?.let { MartHighlightTarget.Product(it, targetName) }
                    "collection" -> targetJson.optString("collection").takeIf { it in MART_PRODUCT_COLLECTIONS }?.let { MartHighlightTarget.Collection(it, targetName) }
                    "category" -> targetJson.optString("categoryId").takeIf(::isSafeMartIdentifier)?.let { MartHighlightTarget.Category(it, targetName) }
                    else -> null
                } ?: continue
                val ranking = row.optJSONObject("ranking")?.optJSONObject("reason")
                val sponsoredJson = row.optJSONObject("sponsored")
                val sponsored = sponsoredJson?.let {
                    val campaignId = it.optString("campaignId")
                    val impressionToken = it.optString("impressionToken")
                    if (isSafeMartIdentifier(campaignId) && impressionToken.isNotBlank() && impressionToken.length <= 2_000) {
                        MartSponsoredPlacement(
                            campaignId = campaignId,
                            label = it.optString("label").trim().ifEmpty { "Sponsored" },
                            advertiserName = it.optString("advertiserName").trim(),
                            impressionToken = impressionToken,
                        )
                    } else null
                }
                add(
                    MartHighlight(
                        id = id,
                        kind = kind,
                        title = title,
                        subtitle = row.optNullableString("subtitle"),
                        imageUrl = safeMediaUrl(row.optNullableString("imageUrl")),
                        target = target,
                        reasonLabel = ranking?.optString("label")?.trim().orEmpty(),
                        sponsored = sponsored,
                    ),
                )
            }
        }
        return MartResult.Highlights(highlights)
    }

    internal fun parseProductDetail(body: String, expectedId: String): MartProductDetail {
        require(isSafeMartIdentifier(expectedId))
        val root = JSONObject(body)
        val id = root.optString("id")
        require(id == expectedId) { "Product response did not match the requested product." }
        val title = root.optString("title").trim().ifEmpty { root.optString("name").trim() }
        require(title.isNotEmpty()) { "Product title is missing." }
        val price = root.optJSONObject("price") ?: error("Product price is missing.")
        val amountMinor = readNonNegativeMinorUnits(price, "amountMinor")
        val currency = readCurrency(price)
        val storeJson = root.optJSONObject("store") ?: error("Product store is missing.")
        val storeId = storeJson.optString("id")
        val storeName = storeJson.optString("name").trim()
        require(isSafeMartIdentifier(storeId) && storeName.isNotEmpty()) { "Product store is invalid." }
        val imagesJson = root.optJSONArray("images") ?: JSONArray()
        val images = buildList {
            for (index in 0 until imagesJson.length()) {
                safeMediaUrl(imagesJson.optString(index).takeUnless { it.isBlank() || it == "null" })?.let(::add)
            }
        }
        val variantsJson = root.optJSONArray("variants") ?: JSONArray()
        val variants = buildList {
            for (index in 0 until variantsJson.length()) {
                val variant = variantsJson.optJSONObject(index) ?: continue
                val variantId = variant.optString("id")
                val variantTitle = variant.optString("title").trim()
                val variantPrice = variant.optJSONObject("price") ?: continue
                if (!isSafeMartIdentifier(variantId) || variantTitle.isEmpty()) continue
                val variantMinor = runCatching { readNonNegativeMinorUnits(variantPrice, "amountMinor") }.getOrNull() ?: continue
                val variantCurrency = runCatching { readCurrency(variantPrice) }.getOrNull() ?: continue
                if (variantCurrency != currency) continue
                val optionValuesJson = variant.optJSONObject("optionValues")
                val optionValues = buildMap {
                    optionValuesJson?.keys()?.forEach { key ->
                        optionValuesJson.optString(key).trim().takeIf(String::isNotEmpty)?.let { put(key, it) }
                    }
                }
                add(
                    MartProductVariant(
                        id = variantId,
                        title = variantTitle,
                        priceMinor = variantMinor,
                        currency = variantCurrency,
                        inStock = variant.optBoolean("inStock"),
                        size = variant.optString("size").trim(),
                        color = variant.optString("color").trim(),
                        optionValues = optionValues,
                    ),
                )
            }
        }
        return MartProductDetail(
            id = id,
            title = title,
            amountMinor = amountMinor,
            currency = currency,
            stock = root.optInt("stock").coerceAtLeast(0),
            images = images,
            rating = root.optDouble("rating").takeIf { it.isFinite() && it >= 0 } ?: 0.0,
            promo = root.optNullableString("promo"),
            sizes = root.readStringList("sizes"),
            colors = root.readStringList("colors"),
            shippingInfo = root.optString("shippingInfo").trim(),
            description = root.optString("description").trim(),
            store = MartStoreSummary(
                id = storeId,
                name = storeName,
                logoUrl = safeMediaUrl(storeJson.optNullableString("logoUrl")),
                rating = storeJson.optDouble("rating").takeIf { it.isFinite() && it >= 0 } ?: 0.0,
                ratingCount = storeJson.optInt("ratingCount").coerceAtLeast(0),
                reviewCount = storeJson.optInt("reviewCount").coerceAtLeast(0),
                isFollowing = storeJson.optBoolean("isFollowing"),
            ),
            variants = variants,
        )
    }
}

internal fun buildMartHomeUrl(origin: String): URL = URL("${validatedMartOrigin(origin)}/api/v1/mart/home")

internal fun buildMartHighlightsUrl(origin: String, limit: Int = MART_HIGHLIGHTS_PAGE_SIZE): URL {
    require(limit in 1..MART_HIGHLIGHTS_PAGE_SIZE)
    return URL("${validatedMartOrigin(origin)}/api/v1/mart/highlights?limit=$limit")
}

internal fun buildMartAdsEventsUrl(origin: String): URL = URL("${validatedMartOrigin(origin)}/api/v1/ads/events")

internal fun buildMartProductsUrl(origin: String, categoryId: String?, cursor: String?, collection: String? = null): URL {
    val parsed = URL(validatedMartOrigin(origin))
    val query = buildList {
        add("limit=20")
        categoryId?.let { add("categoryId=${URLEncoder.encode(it, "UTF-8")}") }
        collection?.let {
            require(it in MART_PRODUCT_COLLECTIONS)
            add("collection=${URLEncoder.encode(it, "UTF-8")}")
        }
        cursor?.let { add("cursor=${URLEncoder.encode(it, "UTF-8")}") }
    }.joinToString("&")
    return URL("${parsed.toString().trimEnd('/')}/api/v1/products?$query")
}

internal fun buildMartProductDetailUrl(origin: String, productId: String): URL {
    require(isSafeMartIdentifier(productId)) { "Invalid product identifier." }
    return URL("${validatedMartOrigin(origin)}/api/v1/products/$productId")
}

private fun readNonNegativeMinorUnits(value: JSONObject, key: String): Long {
    val raw = value.opt(key)
    require(raw is Number) { "Product money must use integer minor units." }
    val number = raw.toLong()
    require(raw.toDouble() == number.toDouble() && number >= 0) { "Product money must use non-negative integer minor units." }
    return number
}

private fun readCurrency(value: JSONObject): String {
    val code = value.optString("currency")
    require(code.matches(Regex("[A-Z]{3}")) && runCatching { java.util.Currency.getInstance(code) }.isSuccess) {
        "Product currency is invalid."
    }
    return code
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }

private fun JSONObject.readStringList(key: String): List<String> {
    val rows = optJSONArray(key) ?: return emptyList()
    return buildList {
        for (index in 0 until rows.length()) rows.optString(index).trim().takeIf(String::isNotEmpty)?.let(::add)
    }
}

private fun readBoundedResponse(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= MAX_MART_RESPONSE_BYTES) { "Mart response exceeded the size limit." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

private const val MAX_MART_RESPONSE_BYTES = 1_000_000

private fun validatedMartOrigin(origin: String): String {
    val parsed = runCatching { URL(origin.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid API URL", it) }
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null) {
        "API URL must use HTTPS (emulator development may use 10.0.2.2) and must not contain credentials or query data."
    }
    return parsed.toString().trimEnd('/')
}

internal fun isSafeMartIdentifier(value: String): Boolean = value.isNotBlank() && value.length <= 100 && value.matches(Regex("[A-Za-z0-9_-]+"))

internal const val MART_HIGHLIGHTS_PAGE_SIZE = 6
internal val MART_PRODUCT_COLLECTIONS = setOf("sales_of_the_day", "featured_brands", "new_arrivals")

private inline fun <T> HttpURLConnection.useConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
