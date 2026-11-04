package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

internal sealed interface AddToCartResult {
    data object Success : AddToCartResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AddToCartResult
}

internal data class CartLine(
    val id: String,
    val productId: String,
    val name: String,
    val imageUrl: String?,
    val quantity: Int,
    val unitAmountMinor: Long,
    val currency: String,
    val variant: String?,
    val storeName: String,
)

internal data class CartSnapshot(
    val lines: List<CartLine>,
    val totalAmountMinor: Long,
    val currency: String,
    val payableGroupCount: Int,
    val itemsTotal: WalletMoney? = null,
    val discounts: WalletMoney? = null,
    val storeCredit: WalletMoney? = null,
    val shipping: WalletMoney? = null,
)

internal sealed interface CartResult {
    data class Success(val cart: CartSnapshot) : CartResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CartResult
}

internal sealed interface CartMutationResult {
    data object Success : CartMutationResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CartMutationResult
}

internal interface CartTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun add(path: String, accessToken: String, body: JSONObject)
    fun patch(path: String, accessToken: String, body: JSONObject)
    fun delete(path: String, accessToken: String)
}

internal class CartRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String?,
    private val transport: CartTransport = JdkCartTransport(baseUrl),
) {
    fun loadCart(): CartResult {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return CartResult.Failure("Sign in to view your cart.", authenticationRequired = true)
        return try {
            CartResult.Success(parseCart(transport.get("/api/v1/cart", token)))
        } catch (error: Exception) {
            CartResult.Failure(cartFailureMessage(error), authenticationRequired = error.isAuthenticationFailure())
        }
    }

    fun addProduct(productId: String, variantId: String?, quantity: Int = 1): AddToCartResult {
        if (!isSafeMartIdentifier(productId) || variantId?.let(::isSafeMartIdentifier) == false || quantity !in 1..99) {
            return AddToCartResult.Failure("Choose a valid product option and quantity.")
        }
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return AddToCartResult.Failure("Sign in to add products to your cart.", authenticationRequired = true)
        return try {
            val body = JSONObject().put("productId", productId).put("quantity", quantity)
            variantId?.let { body.put("variantId", it) }
            transport.add("/api/v1/cart/items", token, body)
            AddToCartResult.Success
        } catch (error: Exception) {
            AddToCartResult.Failure(cartMutationFailureMessage(error, "add this product"), error.isAuthenticationFailure())
        }
    }

    fun changeQuantity(cartItemId: String, quantity: Int): CartMutationResult = mutateCartItem(
        cartItemId = cartItemId,
        action = "update your cart",
    ) { path, token ->
        require(quantity in 1..99) { "Choose a quantity from 1 to 99." }
        transport.patch(path, token, JSONObject().put("quantity", quantity))
    }

    fun removeItem(cartItemId: String): CartMutationResult = mutateCartItem(
        cartItemId = cartItemId,
        action = "remove this item",
    ) { path, token -> transport.delete(path, token) }

    private fun mutateCartItem(cartItemId: String, action: String, request: (String, String) -> Unit): CartMutationResult {
        if (!isSafeMartIdentifier(cartItemId)) return CartMutationResult.Failure("That cart item could not be found.")
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return CartMutationResult.Failure("Sign in to manage your cart.", authenticationRequired = true)
        return try {
            request("/api/v1/cart/items/$cartItemId", token)
            CartMutationResult.Success
        } catch (error: Exception) {
            CartMutationResult.Failure(cartMutationFailureMessage(error, action), error.isAuthenticationFailure())
        }
    }

    internal fun parseCart(payload: JSONObject): CartSnapshot {
        return parseCartPayload(payload)
    }

}

internal fun parseCartPayload(payload: JSONObject): CartSnapshot {
    val data = payload.optJSONObject("data") ?: payload
    val rows = mutableListOf<CartLine>()
    val groups = data.optJSONArray("groups")
    if (groups != null) {
        for (groupIndex in 0 until groups.length()) {
            val group = groups.optJSONObject(groupIndex) ?: continue
            appendCartLines(group.optJSONArray("items"), group.optString("storeName"), rows)
        }
    } else {
        appendCartLines(data.optJSONArray("items"), "", rows)
    }
    val total = data.optJSONObject("total") ?: error("Nantty returned an incomplete cart total.")
    val currency = total.optString("currency").takeIf { it.matches(Regex("[A-Z]{3}")) }
        ?: error("Nantty returned an invalid cart currency.")
    require(total.has("amountMinor")) { "Nantty returned an incomplete cart total." }
    return CartSnapshot(
        lines = rows,
        totalAmountMinor = total.optLong("amountMinor").coerceAtLeast(0L),
        currency = currency,
        payableGroupCount = data.optInt("payableGroupCount").coerceAtLeast(0),
        itemsTotal = data.optJSONObject("itemsTotal")?.toCartMoney(),
        discounts = data.optJSONObject("shopDiscount")?.toCartMoney(),
        storeCredit = data.optJSONObject("storeCredit")?.toCartMoney(),
        shipping = data.optJSONObject("shipping")?.toCartMoney(),
    )
}

private fun JSONObject.toCartMoney(): WalletMoney? {
    val currency = optString("currency")
    if (!currency.matches(Regex("[A-Z]{3}")) || !has("amountMinor")) return null
    return WalletMoney(optLong("amountMinor").coerceAtLeast(0L), currency)
}

private class JdkCartTransport(private val baseUrl: String) : CartTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path == "/api/v1/cart")
        val response = request(path, accessToken, "GET")
        return JSONObject(response)
    }

    override fun add(path: String, accessToken: String, body: JSONObject) {
        require(path == "/api/v1/cart/items")
        request(path, accessToken, "POST", body)
    }

    override fun patch(path: String, accessToken: String, body: JSONObject) {
        require(path.matches(Regex("/api/v1/cart/items/[A-Za-z0-9_-]{1,128}")))
        request(path, accessToken, "PATCH", body)
    }

    override fun delete(path: String, accessToken: String) {
        require(path.matches(Regex("/api/v1/cart/items/[A-Za-z0-9_-]{1,128}")))
        request(path, accessToken, "DELETE")
    }

    private fun request(path: String, accessToken: String, method: String, body: JSONObject? = null): String {
        val url = URL("${validatedCartOrigin(baseUrl)}$path")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = body != null
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        return connection.useCartConnection {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw CartHttpException(status)
            connection.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        }
    }
}
internal class CartHttpException(val statusCode: Int) : Exception()

private fun validatedCartOrigin(origin: String): String {
    val parsed = URL(origin.trim().trimEnd('/'))
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null)
    return parsed.toString().trimEnd('/')
}

private fun appendCartLines(items: JSONArray?, storeName: String, output: MutableList<CartLine>) {
    if (items == null) return
    for (index in 0 until items.length()) {
        val item = items.optJSONObject(index) ?: continue
        val product = item.optJSONObject("product") ?: continue
        val id = item.optString("id").takeIf(String::isNotBlank) ?: continue
        val productId = product.optString("id").takeIf(String::isNotBlank) ?: continue
        val name = product.optString("name").takeIf(String::isNotBlank) ?: continue
        val price = product.optJSONObject("price") ?: continue
        val currency = price.optString("currency").takeIf { it.matches(Regex("[A-Z]{3}")) } ?: continue
        if (!price.has("amountMinor")) continue
        output += CartLine(
            id = id,
            productId = productId,
            name = name.filterNot(Char::isISOControl).take(120),
            imageUrl = product.optString("imageUrl").takeIf(String::isNotBlank),
            quantity = item.optInt("quantity").coerceIn(1, 99),
            unitAmountMinor = price.optLong("amountMinor").coerceAtLeast(0L),
            currency = currency,
            variant = item.optJSONObject("variantDetail")?.optString("title")?.takeIf(String::isNotBlank)
                ?: item.optString("variant").takeIf(String::isNotBlank),
            storeName = storeName.filterNot(Char::isISOControl).take(100),
        )
    }
}

private fun Exception.isAuthenticationFailure(): Boolean =
    (this as? CartHttpException)?.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)

private fun cartFailureMessage(error: Exception): String = when {
    error.isAuthenticationFailure() -> "Your session has expired. Sign in again to view your cart."
    (error as? CartHttpException)?.statusCode == HttpURLConnection.HTTP_NOT_FOUND -> "Your cart is empty."
    else -> "Couldn't load your cart. Please try again."
}

private const val CART_HTTP_UNPROCESSABLE_ENTITY = 422

private fun cartMutationFailureMessage(error: Exception, action: String): String = when ((error as? CartHttpException)?.statusCode) {
    HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> "Your session has expired. Sign in again to manage your cart."
    HttpURLConnection.HTTP_CONFLICT, CART_HTTP_UNPROCESSABLE_ENTITY -> "This cart item is no longer available. Refresh your cart and try again."
    else -> "Couldn't $action. Please try again."
}

private inline fun <T> HttpURLConnection.useCartConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
