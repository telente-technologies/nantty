package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class PublicBrand(
    val id: String,
    val name: String,
    val handle: String,
    val logoUrl: String?,
    val coverUrl: String?,
    val followers: Int,
    val categoryName: String,
    val description: String,
    val website: String?,
    val ownerUserId: String?,
    val isFollowing: Boolean,
    val official: Boolean,
    val officialStoreId: String?,
    val officialStoreName: String?,
    val sellingEnabled: Boolean,
)

data class PublicBrandProducts(val officialStore: List<SearchProduct>, val otherSellers: List<SearchProduct>)
data class PublicBrandPage(val brand: PublicBrand, val products: PublicBrandProducts)

sealed interface PublicBrandResult {
    data class Success(val page: PublicBrandPage) : PublicBrandResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : PublicBrandResult
}

sealed interface BrandFollowResult {
    data class Success(val following: Boolean) : BrandFollowResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : BrandFollowResult
}

interface PublicBrandTransport {
    fun get(path: String, accessToken: String?): JSONObject
    fun post(path: String, accessToken: String): JSONObject = error("This brand transport does not support POST.")
    fun delete(path: String, accessToken: String): JSONObject = error("This brand transport does not support DELETE.")
}

class PublicBrandRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: PublicBrandTransport = JdkPublicBrandTransport(baseUrl),
) {
    fun load(brandId: String): PublicBrandResult = try {
        require(isSafeBrandId(brandId)) { "This brand link is invalid." }
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        val brand = parseBrand(transport.get("/api/v1/brands/${pathSegment(brandId)}", token), brandId)
        val products = parseProducts(transport.get("/api/v1/brands/${pathSegment(brandId)}/products", token))
        PublicBrandResult.Success(PublicBrandPage(brand, products))
    } catch (error: Exception) {
        PublicBrandResult.Failure(error.message ?: "Could not load this brand. Check your connection and try again.")
    }

    fun setFollowing(brandId: String, follow: Boolean): BrandFollowResult {
        if (!isSafeBrandId(brandId)) return BrandFollowResult.Failure("This brand link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return BrandFollowResult.Failure("Sign in to follow brands.", authenticationRequired = true)
        return try {
            val path = "/api/v1/brands/${pathSegment(brandId)}/follow"
            if (follow) transport.post(path, token) else transport.delete(path, token)
            BrandFollowResult.Success(follow)
        } catch (error: BrandTransportException) {
            BrandFollowResult.Failure(
                error.message ?: "Could not update this brand. Try again.",
                authenticationRequired = error.statusCode in AUTH_REQUIRED_STATUS,
            )
        } catch (error: Exception) {
            BrandFollowResult.Failure(error.message ?: "Could not update this brand. Check your connection and try again.")
        }
    }

    internal fun parseBrand(payload: JSONObject, expectedId: String): PublicBrand {
        val root = payload.optJSONObject("data") ?: payload
        val id = root.optString("id")
        require(id == expectedId && isSafeBrandId(id)) { "Nantty returned a different brand than requested." }
        val name = root.optString("name").trim()
        val handle = root.optString("handle").trim().ifEmpty { root.optString("slug").trim() }
        require(name.isNotEmpty() && handle.isNotEmpty()) { "Nantty returned incomplete brand details." }
        val officialStore = root.optJSONObject("officialStore")
        return PublicBrand(
            id = id,
            name = name,
            handle = handle,
            logoUrl = safeMediaUrl(root.optNullableString("logoUrl")),
            coverUrl = safeMediaUrl(root.optNullableString("coverUrl")),
            followers = root.optInt("followers").coerceAtLeast(0),
            categoryName = root.optString("categoryName").trim(),
            description = root.optString("description").trim(),
            website = root.optNullableString("website"),
            ownerUserId = root.optString("ownerUserId").takeIf(::isSafeBrandId),
            isFollowing = root.optBoolean("isFollowing"),
            official = root.optBoolean("official"),
            officialStoreId = officialStore?.optString("id")?.takeIf(::isSafeBrandId),
            officialStoreName = officialStore?.optNullableString("name"),
            sellingEnabled = root.optBoolean("sellingEnabled", true),
        )
    }

    internal fun parseProducts(payload: JSONObject): PublicBrandProducts {
        val root = payload.optJSONObject("data") ?: payload
        return PublicBrandProducts(
            officialStore = parseProductList(root.optJSONArray("officialStoreProducts")),
            otherSellers = parseProductList(root.optJSONArray("otherSellersProducts")),
        )
    }

    private fun parseProductList(rows: JSONArray?): List<SearchProduct> = buildList {
        if (rows == null) return@buildList
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id")
            val name = row.optString("name").trim()
            val price = row.optJSONObject("price")
            val amount = price?.optLong("amountMinor", -1L) ?: -1L
            val currency = price?.optString("currency")?.takeIf { it.matches(Regex("[A-Z]{3}")) } ?: continue
            if (!isSafeBrandId(id) || name.isEmpty() || amount < 0) continue
            add(SearchProduct(id, name, amount, currency, safeMediaUrl(row.optNullableString("imageUrl")), row.optInt("stock").coerceAtLeast(0)))
        }
    }

    companion object {
        const val BRAND_PATH = "/api/v1/brands"
        const val BRAND_PRODUCTS_SUFFIX = "/products"
        const val FOLLOW_SUFFIX = "/follow"
        private val AUTH_REQUIRED_STATUS = setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)
    }
}

class BrandTransportException(val statusCode: Int) : Exception("Brand request failed (HTTP $statusCode). Please try again.")

private class JdkPublicBrandTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : PublicBrandTransport {
    override fun get(path: String, accessToken: String?): JSONObject = request("GET", path, accessToken)
    override fun post(path: String, accessToken: String): JSONObject = request("POST", path, accessToken)
    override fun delete(path: String, accessToken: String): JSONObject = request("DELETE", path, accessToken)

    private fun request(method: String, path: String, accessToken: String?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view brands.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw BrandTransportException(status)
            val body = (if (status == HttpURLConnection.HTTP_NO_CONTENT) null else connection.inputStream)
                ?.use(::readBoundedBrandResponse).orEmpty()
            return if (body.isBlank()) JSONObject() else JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedBrandResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large brand response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

private fun pathSegment(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private fun isSafeBrandId(value: String): Boolean = value.isNotBlank() && value.length <= 100 && value.matches(Regex("[A-Za-z0-9_-]+"))

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
