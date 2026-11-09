package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class ProductSaveResponse(val status: Int, val body: String)

internal fun interface ProductSaveTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?): ProductSaveResponse
}

sealed interface ProductSaveStatusResult {
    data class Success(val isSaved: Boolean) : ProductSaveStatusResult
    data object AuthenticationRequired : ProductSaveStatusResult
    data class Failure(val message: String) : ProductSaveStatusResult
}

sealed interface ProductSaveMutationResult {
    data object Success : ProductSaveMutationResult
    data object AuthenticationRequired : ProductSaveMutationResult
    data class Failure(val message: String) : ProductSaveMutationResult
}

/** Uses the Social saves API so product bookmarks match React Native and the Saved collection. */
internal class ProductSaveRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String?,
    private val transport: ProductSaveTransport = JdkProductSaveTransport(baseUrl),
) {
    fun loadStatus(productId: String): ProductSaveStatusResult {
        if (!isSafeMartIdentifier(productId)) return ProductSaveStatusResult.Failure("This product link is invalid.")
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return ProductSaveStatusResult.AuthenticationRequired
        return try {
            val response = transport.request("GET", buildProductSaveStatusPath(productId), token, null)
            when {
                response.status in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN) -> ProductSaveStatusResult.AuthenticationRequired
                response.status !in 200..299 -> ProductSaveStatusResult.Failure("Could not check whether this product is saved. Try again.")
                else -> {
                    val root = JSONObject(response.body)
                    val value = root.optJSONObject("data") ?: root
                    if (!value.has("isSaved") || value.isNull("isSaved")) {
                        ProductSaveStatusResult.Failure("Nantty returned an incomplete saved-product status.")
                    } else ProductSaveStatusResult.Success(value.getBoolean("isSaved"))
                }
            }
        } catch (_: Exception) {
            ProductSaveStatusResult.Failure("Could not check whether this product is saved. Check your connection and try again.")
        }
    }

    fun setSaved(productId: String, saved: Boolean): ProductSaveMutationResult {
        if (!isSafeMartIdentifier(productId)) return ProductSaveMutationResult.Failure("This product link is invalid.")
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return ProductSaveMutationResult.AuthenticationRequired
        return try {
            val response = if (saved) {
                transport.request(
                    "POST",
                    "/api/v1/saves",
                    token,
                    JSONObject().put("type", "product").put("targetId", productId),
                )
            } else {
                transport.request("DELETE", buildProductUnsavePath(productId), token, null)
            }
            when {
                response.status in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN) -> ProductSaveMutationResult.AuthenticationRequired
                response.status in 200..299 -> ProductSaveMutationResult.Success
                else -> ProductSaveMutationResult.Failure(if (saved) "Couldn't save this product. Try again." else "Couldn't remove this product from Saved. Try again.")
            }
        } catch (_: Exception) {
            ProductSaveMutationResult.Failure(if (saved) "Couldn't save this product. Check your connection and try again." else "Couldn't remove this product from Saved. Check your connection and try again.")
        }
    }
}

internal fun buildProductSaveStatusPath(productId: String): String =
    "/api/v1/saves/status?type=product&targetId=${productId.encodeProductSaveQuery()}"

internal fun buildProductUnsavePath(productId: String): String =
    "/api/v1/saves?type=product&targetId=${productId.encodeProductSaveQuery()}"

private fun String.encodeProductSaveQuery(): String =
    URLEncoder.encode(this, Charsets.UTF_8.name()).replace("+", "%20")

private class JdkProductSaveTransport(
    baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : ProductSaveTransport {
    private val origin = trustedProductSaveOrigin(baseUrl)

    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): ProductSaveResponse {
        require(path.startsWith("/api/v1/saves")) { "Invalid saved-product request." }
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = method
            connectTimeout = PRODUCT_SAVE_CONNECT_TIMEOUT_MILLIS
            readTimeout = PRODUCT_SAVE_READ_TIMEOUT_MILLIS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        return try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            ProductSaveResponse(status, stream?.use(::readProductSaveResponse).orEmpty())
        } finally {
            connection.disconnect()
        }
    }
}

private fun trustedProductSaveOrigin(origin: String): String {
    val parsed = runCatching { URL(origin.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid API URL", it) }
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null) {
        "Saved-product requests require a trusted HTTPS API address."
    }
    return parsed.toString().trimEnd('/')
}

private fun readProductSaveResponse(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(4_096)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= MAX_PRODUCT_SAVE_RESPONSE_BYTES) { "Saved-product response exceeded the size limit." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

private const val PRODUCT_SAVE_CONNECT_TIMEOUT_MILLIS = 10_000
private const val PRODUCT_SAVE_READ_TIMEOUT_MILLIS = 15_000
private const val MAX_PRODUCT_SAVE_RESPONSE_BYTES = 64_000
