package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class MartCategory(val id: String, val name: String, val depth: Int)
data class MartProduct(val id: String, val name: String, val amountMinor: Long, val currency: String, val imageUrl: String?, val stock: Int)
data class MartPage(val products: List<MartProduct>, val nextCursor: String?)
data class MartHome(val categories: List<MartCategory>)

sealed interface MartResult {
    data class Home(val value: MartHome) : MartResult
    data class Products(val value: MartPage) : MartResult
    data class Failure(val message: String) : MartResult
}

class MartRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    fun loadHome(): MartResult = get(buildMartHomeUrl(baseUrl), ::parseHome)

    fun loadProducts(categoryId: String? = null, cursor: String? = null): MartResult {
        if (categoryId != null && !isSafeMartIdentifier(categoryId)) return MartResult.Failure("Nantty returned an invalid category. Refresh the Mart and try again.")
        if (cursor != null && cursor.length > 300) return MartResult.Failure("The product page cursor is invalid. Refresh the Mart and try again.")
        return get(buildMartProductsUrl(baseUrl, categoryId, cursor), ::parseProducts)
    }

    private fun get(url: URL, parse: (String) -> MartResult): MartResult {
        return try {
            val connection = openConnection(url)
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) MartResult.Failure("Mart request failed (HTTP $status). Please try again later.")
                else runCatching { parse(body) }.getOrElse { MartResult.Failure("Nantty returned catalogue data that could not be read.") }
            }
        } catch (_: Exception) {
            MartResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    private fun parseHome(body: String): MartResult.Home {
        val rows = JSONObject(body).optJSONArray("categories") ?: JSONArray()
        val categories = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("name").trim()
                if (isSafeMartIdentifier(id) && name.isNotEmpty()) add(MartCategory(id, name, item.optInt("depth").coerceAtLeast(0)))
            }
        }
        return MartResult.Home(MartHome(categories))
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
}

internal fun buildMartHomeUrl(origin: String): URL = URL("${validatedMartOrigin(origin)}/api/v1/mart/home")

internal fun buildMartProductsUrl(origin: String, categoryId: String?, cursor: String?): URL {
    val parsed = URL(validatedMartOrigin(origin))
    val query = buildList {
        add("limit=20")
        categoryId?.let { add("categoryId=${URLEncoder.encode(it, "UTF-8")}") }
        cursor?.let { add("cursor=${URLEncoder.encode(it, "UTF-8")}") }
    }.joinToString("&")
    return URL("${parsed.toString().trimEnd('/')}/api/v1/products?$query")
}

private fun validatedMartOrigin(origin: String): String {
    val parsed = runCatching { URL(origin.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid API URL", it) }
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null) {
        "API URL must use HTTPS (emulator development may use 10.0.2.2) and must not contain credentials or query data."
    }
    return parsed.toString().trimEnd('/')
}

internal fun isSafeMartIdentifier(value: String): Boolean = value.isNotBlank() && value.length <= 100 && value.matches(Regex("[A-Za-z0-9_-]+"))

private inline fun <T> HttpURLConnection.useConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
