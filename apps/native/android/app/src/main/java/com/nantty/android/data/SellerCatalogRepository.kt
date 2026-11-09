package com.nantty.android.data

import android.content.ContentResolver
import android.net.Uri
import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal sealed interface SellerCatalogResult<out T> {
    data class Success<T>(val value: T) : SellerCatalogResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerCatalogResult<Nothing>
}

internal data class SellerCatalogResponse(val status: Int, val body: String)

internal fun interface SellerCatalogTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): SellerCatalogResponse
}

/** Seller-owned catalog operations mirrored from the React Native seller service. */
internal class SellerCatalogRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerCatalogTransport = JdkSellerCatalogTransport(BuildConfig.NANTTY_API_BASE_URL),
    private val mediaUploads: CreatorSampleMediaRepository? = null,
) {
    fun load(): SellerCatalogResult<List<SellerCatalogProduct>> = request("load your products") { response ->
        val root = JSONObject(response.body)
        val rows = root.optJSONArray("data") ?: error("Nantty returned an incomplete product list.")
        buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                runCatching { parseSellerCatalogProduct(row) }.getOrNull()?.let(::add)
            }
        }.filterNot { it.status == "archived" }
    }

    fun loadProduct(productId: String): SellerCatalogResult<SellerCatalogProduct> {
        if (!isSafeMartIdentifier(productId)) return SellerCatalogResult.Failure("That product could not be found.")
        return request("load this product", path = productPath(productId)) { response ->
            parseSellerCatalogProduct(JSONObject(response.body), expectedId = productId)
        }
    }

    fun loadLocations(): SellerCatalogResult<List<SellerCatalogLocation>> = request("load store locations", path = LOCATIONS_PATH) { response ->
        parseSellerCatalogLocations(JSONObject(response.body))
    }

    fun searchBrands(query: String): SellerCatalogResult<List<SellerCatalogBrand>> {
        val normalized = query.trim().take(100)
        val encoded = URLEncoder.encode(normalized, Charsets.UTF_8.name())
        return request("search brands", path = "$BRANDS_PATH?q=$encoded") { response ->
            parseSellerCatalogBrands(JSONObject(response.body))
        }
    }

    fun setPublished(productId: String, publish: Boolean): SellerCatalogResult<Unit> {
        if (!isSafeMartIdentifier(productId)) return SellerCatalogResult.Failure("That product could not be found.")
        val action = if (publish) "publish" else "unpublish"
        return request(
            action = "$action this product",
            method = "POST",
            path = buildSellerCatalogPublicationPath(productId, publish),
            body = null,
            idempotencyKey = null,
        ) { response ->
            val root = JSONObject(response.body)
            val product = root.optJSONObject("data") ?: root
            require(product.optString("id") == productId && product.optBoolean("publishedOnline") == publish) {
                "Nantty did not confirm the product's new status. Refresh before trying again."
            }
            Unit
        }
    }

    fun save(input: SellerCatalogUpsert): SellerCatalogResult<SellerCatalogProduct> {
        val message = validateSellerCatalogForm(input)
        if (message != null) return SellerCatalogResult.Failure(message)
        val mutation = buildSellerCatalogProductBody(input)
            ?: return SellerCatalogResult.Failure("Check the product details and try again.")
        return request(
            action = if (mutation.method == "POST") "create this product" else "save product changes",
            method = mutation.method,
            path = mutation.path,
            body = mutation.body,
            idempotencyKey = mutation.idempotencyKey,
        ) { response ->
            parseSellerCatalogProduct(JSONObject(response.body), expectedId = input.product?.id)
        }
    }

    fun archive(productId: String): SellerCatalogResult<SellerCatalogProduct> {
        if (!isSafeMartIdentifier(productId)) return SellerCatalogResult.Failure("That product could not be found.")
        return request("archive this product", method = "DELETE", path = productPath(productId)) { response ->
            parseSellerCatalogProduct(JSONObject(response.body), expectedId = productId)
        }
    }

    fun uploadProductImage(
        uri: Uri,
        resolver: ContentResolver,
        cacheDir: java.io.File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
    ): CreatorSampleMediaResult = mediaUploads?.upload(uri, resolver, cacheDir, cancellation, NativeImageUploadPurpose.PRODUCT)
            ?: CreatorSampleMediaResult.Failure("Product photo uploads are unavailable. Please try again later.")

    private fun <T> request(
        action: String,
        method: String = "GET",
        path: String = PRODUCTS_PATH,
        body: JSONObject? = null,
        idempotencyKey: String? = null,
        block: (SellerCatalogResponse) -> T,
    ): SellerCatalogResult<T> {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return SellerCatalogResult.Failure("Sign in to $action.", authenticationRequired = true)
        return try {
            val response = transport.request(method, path, token, body, idempotencyKey)
            if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED || response.status == HttpURLConnection.HTTP_FORBIDDEN) {
                return SellerCatalogResult.Failure("Your session has expired. Sign in again to $action.", authenticationRequired = true)
            }
            if (response.status !in 200..299) return SellerCatalogResult.Failure("Couldn't $action. Please try again.")
            SellerCatalogResult.Success(block(response))
        } catch (error: SellerCatalogHttpException) {
            SellerCatalogResult.Failure(
                if (error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN) {
                    "Your session has expired. Sign in again to $action."
                } else "Couldn't $action. Please try again.",
                authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
            )
        } catch (_: Exception) {
            SellerCatalogResult.Failure("Couldn't $action. Check your connection and try again.")
        }
    }

    companion object {
        const val PRODUCTS_PATH = "/api/v1/seller/products?limit=100"
        const val PRODUCTS_COLLECTION_PATH = "/api/v1/seller/products"
        const val LOCATIONS_PATH = "/api/v1/seller/locations"
        const val BRANDS_PATH = "/api/v1/brands"

        fun productPath(productId: String): String {
            require(isSafeMartIdentifier(productId)) { "Invalid product identifier." }
            return "/api/v1/seller/products/$productId"
        }
    }
}

private const val PUBLISH_PATH = "/api/v1/seller/products/"
internal fun buildSellerCatalogPublicationPath(productId: String, publish: Boolean): String {
    require(isSafeMartIdentifier(productId)) { "Invalid product identifier." }
    return "$PUBLISH_PATH$productId/${if (publish) "publish" else "unpublish"}"
}

internal fun isSafeSellerCatalogImageUrl(value: String): Boolean = runCatching {
    val uri = java.net.URI(value)
    uri.isAbsolute && uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null
}.getOrDefault(false)

internal class SellerCatalogHttpException(val statusCode: Int) : Exception()

private class JdkSellerCatalogTransport(baseUrl: String) : SellerCatalogTransport {
    private val origin = runCatching { java.net.URL(baseUrl.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid Nantty API URL.", it) }

    override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): SellerCatalogResponse {
        require(
            path == SellerCatalogRepository.PRODUCTS_PATH ||
                path == SellerCatalogRepository.PRODUCTS_COLLECTION_PATH ||
                path == SellerCatalogRepository.LOCATIONS_PATH ||
                path == SellerCatalogRepository.BRANDS_PATH ||
                Regex("^/api/v1/brands\\?q=[^\\r\\n]{0,300}$").matches(path) ||
                Regex("^/api/v1/seller/products/[A-Za-z0-9_-]{1,100}$").matches(path) ||
                Regex("^/api/v1/seller/products/[A-Za-z0-9_-]{1,100}/(publish|unpublish)$").matches(path),
        )
        when {
            method == "POST" && path == SellerCatalogRepository.PRODUCTS_COLLECTION_PATH -> require(body != null && idempotencyKey != null)
            method == "PATCH" && Regex("^/api/v1/seller/products/[A-Za-z0-9_-]{1,100}$").matches(path) -> require(body != null && idempotencyKey == null)
            else -> require(body == null && idempotencyKey == null)
        }
        require(origin.protocol == "https" || origin.protocol == "http" && origin.host == "10.0.2.2")
        val connection = (URL(origin.toString().trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
            }
        }
        return try {
            body?.let { payload -> connection.outputStream.use { output -> output.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                val text = reader.readText()
                require(text.toByteArray(Charsets.UTF_8).size <= MAX_RESPONSE_BYTES)
                text
            }.orEmpty()
            if (status !in 200..299) throw SellerCatalogHttpException(status)
            require(body.isNotBlank()) { "Nantty returned an empty product response." }
            SellerCatalogResponse(status, body)
        } finally {
            connection.disconnect()
        }
    }
}

private const val MAX_RESPONSE_BYTES = 2_097_152
