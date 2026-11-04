package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class PublicStore(
    val id: String,
    val name: String,
    val handle: String,
    val bio: String,
    val logoUrl: String?,
    val bannerUrl: String?,
    val followers: Int,
    val productsCount: Int,
    val rating: Double,
    val ratingCount: Int,
    val verified: Boolean,
    val isFollowing: Boolean = false,
)

data class PublicStorePage(val store: PublicStore, val products: List<SearchProduct>, val nextCursor: String?)

sealed interface PublicStoreResult {
    data class Success(val page: PublicStorePage) : PublicStoreResult
    data class Failure(val message: String) : PublicStoreResult
}

fun interface StoreTransport {
    fun get(path: String, accessToken: String?): JSONObject
    fun post(path: String, accessToken: String): JSONObject { error("This store transport does not support writes.") }
    fun delete(path: String, accessToken: String): Unit { error("This store transport does not support writes.") }
}

data class StoreFollowState(val storeId: String, val isFollowing: Boolean, val followers: Int)

sealed interface StoreFollowResult {
    data class Success(val state: StoreFollowState) : StoreFollowResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoreFollowResult
}

class StoreRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: StoreTransport = JdkStoreTransport(baseUrl),
) {
    fun currentAccessToken(): String? = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)

    fun loadStore(storeId: String, cursor: String? = null): PublicStoreResult = try {
        require(isSafeMartIdentifier(storeId)) { "This store link is invalid." }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This store page cursor is invalid. Refresh the store and try again." }
        val accessToken = currentAccessToken()
        val storePayload = transport.get("/api/v1/stores/${pathSegment(storeId)}", accessToken)
        val store = parseStore(storePayload, storeId)
        val productPath = buildString {
            append("/api/v1/stores/${pathSegment(storeId)}/products?limit=$PRODUCT_PAGE_SIZE")
            cursor?.let { append("&cursor=${queryValue(it)}") }
        }
        val productsPayload = transport.get(productPath, accessToken)
        PublicStoreResult.Success(parsePage(store, productsPayload))
    } catch (error: Exception) {
        PublicStoreResult.Failure(error.message ?: "Could not load this store. Check your connection and try again.")
    }

    fun setFollowing(storeId: String, follow: Boolean): StoreFollowResult {
        if (!isSafeMartIdentifier(storeId)) return StoreFollowResult.Failure("This store link is invalid.")
        val token = currentAccessToken() ?: return StoreFollowResult.Failure("Sign in to follow stores.", authenticationRequired = true)
        val path = "/api/v1/stores/${pathSegment(storeId)}/follow"
        return try {
            if (follow) {
                transport.post(path, token)
            } else {
                transport.delete(path, token)
            }
            val response = transport.get("/api/v1/stores/${pathSegment(storeId)}/follow-status", token)
            StoreFollowResult.Success(parseFollowState(response, storeId, expectedFollowing = follow))
        } catch (error: StoreTransportException) {
            StoreFollowResult.Failure(error.message ?: "Could not update this store. Try again.", authenticationRequired = error.statusCode == 401)
        } catch (error: Exception) {
            StoreFollowResult.Failure(error.message ?: "Could not update this store. Check your connection and try again.")
        }
    }

    private fun parseFollowState(payload: JSONObject, expectedId: String, expectedFollowing: Boolean): StoreFollowState {
        val value = payload.optJSONObject("data") ?: payload
        val id = value.optString("storeId")
        val isFollowing = value.optBoolean("isFollowing")
        require(id == expectedId && isSafeMartIdentifier(id) && isFollowing == expectedFollowing) { "Nantty returned an invalid store-follow state." }
        return StoreFollowState(id, isFollowing, value.optInt("followers").coerceAtLeast(0))
    }

    internal fun parseStore(payload: JSONObject, expectedId: String): PublicStore {
        val value = payload.optJSONObject("data") ?: payload
        val id = value.optString("id")
        val name = value.optNullableString("name")?.trim().orEmpty()
        require(id == expectedId && isSafeMartIdentifier(id) && name.isNotEmpty()) { "Nantty returned invalid store details." }
        return PublicStore(
            id = id,
            name = name.take(MAX_NAME_LENGTH),
            handle = value.optNullableString("handle")?.trim()?.removePrefix("@")?.take(MAX_HANDLE_LENGTH).orEmpty(),
            bio = value.optNullableString("bio")?.filterNot(Char::isISOControl)?.take(MAX_BIO_LENGTH).orEmpty(),
            logoUrl = safeMediaUrl(value.optNullableString("logoUrl")),
            bannerUrl = safeMediaUrl(value.optNullableString("bannerUrl")),
            followers = value.optInt("followers").coerceAtLeast(0),
            productsCount = value.optInt("productsCount").coerceAtLeast(0),
            rating = value.optDouble("rating").takeIf(Double::isFinite)?.coerceIn(0.0, 5.0) ?: 0.0,
            ratingCount = value.optInt("ratingCount").coerceAtLeast(0),
            verified = value.optBoolean("verified"),
            isFollowing = value.optBoolean("isFollowing"),
        )
    }

    private fun parsePage(store: PublicStore, payload: JSONObject): PublicStorePage {
        val rows = payload.optJSONArray("data") ?: payload.optJSONArray("items") ?: JSONArray()
        val products = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optNullableString("name")?.trim().orEmpty()
                val price = item.optJSONObject("price") ?: continue
                val amount = price.optLong("amountMinor", -1)
                val currency = price.optString("currency")
                if (!isSafeMartIdentifier(id) || name.isEmpty() || amount < 0 || !currency.matches(Regex("[A-Z]{3}"))) continue
                add(SearchProduct(
                    id = id,
                    name = name.take(MAX_NAME_LENGTH),
                    amountMinor = amount,
                    currency = currency,
                    imageUrl = safeMediaUrl(item.optNullableString("imageUrl")),
                    stock = item.optInt("stock").coerceAtLeast(0),
                ))
            }
        }
        val cursor = payload.optNullableString("nextCursor")?.takeIf { it.length <= MAX_CURSOR_LENGTH }
        return PublicStorePage(store, products, cursor)
    }

    companion object {
        const val PRODUCT_PAGE_SIZE = 20
        const val MAX_CURSOR_LENGTH = 300
        const val MAX_NAME_LENGTH = 120
        const val MAX_HANDLE_LENGTH = 80
        const val MAX_BIO_LENGTH = 500
    }
}

private fun pathSegment(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
private fun queryValue(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private class JdkStoreTransport(private val baseUrl: String) : StoreTransport {
    override fun get(path: String, accessToken: String?): JSONObject {
        return request(path, "GET", accessToken)
    }

    override fun post(path: String, accessToken: String): JSONObject = request(path, "POST", accessToken, allowEmpty = true)

    override fun delete(path: String, accessToken: String) {
        request(path, "DELETE", accessToken, allowEmpty = true)
    }

    private fun request(path: String, method: String, accessToken: String?, allowEmpty: Boolean = false): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view stores.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw StoreTransportException(status, "Store request failed (HTTP $status). Please try again.")
            if (body.isBlank() && allowEmpty) return JSONObject()
            if (body.isBlank()) error("Nantty returned an empty store response.")
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large store response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

class StoreTransportException(val statusCode: Int, message: String) : IllegalStateException(message)
