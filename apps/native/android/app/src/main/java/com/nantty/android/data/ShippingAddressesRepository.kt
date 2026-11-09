package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

internal data class SavedShippingAddress(
    val id: String,
    val fullName: String,
    val phone: String,
    val line1: String,
    val postalCode: String,
    val details: String,
    val isDefault: Boolean,
    val countryId: String,
    val countryCode: String,
    val country: String,
    val stateId: String?,
    val state: String,
    val lgaId: String?,
    val lga: String?,
    val cityId: String?,
    val city: String,
)

internal data class SavedShippingAddressInput(
    val fullName: String,
    val phone: String,
    val line1: String,
    val postalCode: String,
    val details: String,
    val isDefault: Boolean,
    val countryId: String,
    val stateId: String?,
    val lgaId: String?,
    val cityId: String?,
)

internal sealed interface ShippingAddressesResult {
    data class Success(val addresses: List<SavedShippingAddress>) : ShippingAddressesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ShippingAddressesResult
}

internal sealed interface ShippingAddressResult {
    data class Success(val address: SavedShippingAddress) : ShippingAddressResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ShippingAddressResult
}

internal sealed interface ShippingAddressDeleteResult {
    data object Success : ShippingAddressDeleteResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ShippingAddressDeleteResult
}

internal fun interface ShippingAddressTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject
}

/** Authenticated owner-only address book API. Location options are provided by CheckoutRepository's geo catalogue. */
internal class ShippingAddressesRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: ShippingAddressTransport = JdkShippingAddressTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(): ShippingAddressesResult = execute { token ->
        parseAddressList(withRefresh(token) { transport.request("GET", COLLECTION_PATH, it, null) })
    }.let { result ->
        when (result) {
            is RepositoryResult.Value -> ShippingAddressesResult.Success(result.value)
            is RepositoryResult.Error -> ShippingAddressesResult.Failure(result.message, result.authenticationRequired)
        }
    }

    fun create(input: SavedShippingAddressInput): ShippingAddressResult = mutate {
        transport.request("POST", COLLECTION_PATH, it, input.toJson())
    }

    fun update(addressId: String, input: SavedShippingAddressInput): ShippingAddressResult = mutate {
        transport.request("PATCH", addressPath(addressId), it, input.toJson())
    }

    fun setDefault(addressId: String): ShippingAddressResult = mutate {
        transport.request("PATCH", addressPath(addressId), it, JSONObject().put("isDefault", true))
    }

    fun delete(addressId: String): ShippingAddressDeleteResult = try {
        val path = addressPath(addressId)
        withCurrentSession { token -> withRefresh(token) { transport.request("DELETE", path, it, null) } }
        ShippingAddressDeleteResult.Success
    } catch (error: Exception) {
        ShippingAddressDeleteResult.Failure(error.safeAddressMessage("delete this address"), error.isAuthenticationFailure())
    }

    private fun mutate(request: (String) -> JSONObject): ShippingAddressResult = execute { token ->
        parseAddress(unwrapAddressObject(withRefresh(token, request)))
    }.let { result ->
        when (result) {
            is RepositoryResult.Value -> ShippingAddressResult.Success(result.value)
            is RepositoryResult.Error -> ShippingAddressResult.Failure(result.message, result.authenticationRequired)
        }
    }

    private inline fun <T> execute(action: (String) -> T): RepositoryResult<T> = try {
        RepositoryResult.Value(withCurrentSession(action))
    } catch (error: Exception) {
        RepositoryResult.Error(error.safeAddressMessage("manage your addresses"), error.isAuthenticationFailure())
    }

    private inline fun <T> withCurrentSession(action: (String) -> T): T {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw ShippingAddressHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to manage shipping addresses.")
        return action(token)
    }

    private inline fun <T> withRefresh(token: String, request: (String) -> T): T = try {
        request(token)
    } catch (error: ShippingAddressHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
        val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw ShippingAddressHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
        request(refreshedToken)
    }

    private fun addressPath(addressId: String): String {
        require(UUID_PATTERN.matches(addressId)) { "Choose a valid saved address." }
        return "$COLLECTION_PATH/$addressId"
    }

    private fun SavedShippingAddressInput.toJson(): JSONObject {
        validate()
        return JSONObject()
            .put("fullName", fullName.trim())
            .put("phone", normalizeAddressPhone(phone))
            .put("line1", line1.trim())
            .put("postalCode", postalCode.trim())
            .put("details", details.trim())
            .put("isDefault", isDefault)
            .put("countryId", countryId.trim())
            .put("stateId", stateId.toJsonValue())
            .put("lgaId", lgaId.toJsonValue())
            .put("cityId", cityId.toJsonValue())
    }

    private fun SavedShippingAddressInput.validate() {
        require(fullName.trim().length in 2..80) { "Enter the recipient's full name." }
        require(normalizeAddressPhone(phone).matches(PHONE_PATTERN)) {
            "Enter a phone number with country code, such as +2348012345678."
        }
        require(line1.trim().length in 3..160) { "Enter a valid street address." }
        require(countryId.trim().length in 2..36) { "Choose a valid country." }
        require(postalCode.trim().length <= 12) { "Postal code must be 12 characters or fewer." }
        require(details.trim().length <= 300) { "Delivery details must be 300 characters or fewer." }
        listOf(stateId, lgaId, cityId).filterNotNull().forEach {
            require(UUID_PATTERN.matches(it)) { "Choose a valid location from the list." }
        }
    }

    private fun String?.toJsonValue(): Any = this?.trim()?.takeIf(String::isNotEmpty) ?: JSONObject.NULL

    private fun parseAddressList(payload: JSONObject): List<SavedShippingAddress> {
        val data = payload.opt("data")
        val rows = when (data) {
            is JSONArray -> data
            is JSONObject -> data.optJSONArray("data") ?: data.optJSONArray("items")
            else -> payload.optJSONArray("items")
        } ?: error("Nantty returned an incomplete address list.")
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                runCatching { parseAddress(row) }.getOrNull()?.let(::add)
            }
        }
    }

    private fun parseAddress(row: JSONObject): SavedShippingAddress {
        val id = row.optString("id")
        val fullName = row.safeText("fullName", 80)
        val line1 = row.safeText("line1", 160)
        require(UUID_PATTERN.matches(id) && fullName.length in 2..80 && line1.length in 3..160) {
            "Nantty returned an incomplete shipping address."
        }
        val countryId = row.safeText("countryId", 36)
        require(countryId.length in 2..36) { "Nantty returned an invalid shipping country." }
        return SavedShippingAddress(
            id = id,
            fullName = fullName,
            phone = row.safeText("phone", 40),
            line1 = line1,
            postalCode = row.safeText("postalCode", 12),
            details = row.safeText("details", 300),
            isDefault = row.optBoolean("isDefault"),
            countryId = countryId,
            countryCode = row.safeText("countryCode", 2),
            country = row.safeText("country", 100),
            stateId = row.nullableText("stateId", 36),
            state = row.safeText("state", 80),
            lgaId = row.nullableText("lgaId", 36),
            lga = row.nullableText("lga", 100),
            cityId = row.nullableText("cityId", 36),
            city = row.safeText("city", 80),
        )
    }

    private fun JSONObject.safeText(key: String, maxLength: Int): String =
        optString(key).filterNot(Char::isISOControl).trim().take(maxLength).takeUnless { it == "null" }.orEmpty()

    private fun JSONObject.nullableText(key: String, maxLength: Int): String? =
        if (!has(key) || isNull(key)) null else safeText(key, maxLength).takeIf(String::isNotBlank)

    private fun unwrapAddressObject(payload: JSONObject): JSONObject = payload.optJSONObject("data") ?: payload

    private fun Exception.isAuthenticationFailure(): Boolean =
        this is ShippingAddressHttpException && statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)

    private fun Exception.safeAddressMessage(action: String): String = when {
        this is ShippingAddressHttpException && message?.isNotBlank() == true -> message.orEmpty()
        this is ShippingAddressHttpException && statusCode == HttpURLConnection.HTTP_CONFLICT -> "This address could not be changed. Refresh and try again."
        this is ShippingAddressHttpException -> "Nantty couldn't $action (HTTP $statusCode). Please try again."
        message?.isNotBlank() == true -> message.orEmpty()
        else -> "Couldn't $action. Check your connection and try again."
    }

    private sealed interface RepositoryResult<out T> {
        data class Value<T>(val value: T) : RepositoryResult<T>
        data class Error(val message: String, val authenticationRequired: Boolean) : RepositoryResult<Nothing>
    }

    private companion object {
        const val COLLECTION_PATH = "/api/v1/users/me/addresses"
        val UUID_PATTERN = Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
        val PHONE_PATTERN = Regex("^\\+[1-9][0-9]{7,14}$")
    }
}

internal class ShippingAddressHttpException(val statusCode: Int, message: String) : IllegalStateException(message)

private class JdkShippingAddressTransport(private val baseUrl: String) : ShippingAddressTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        require(method in setOf("GET", "POST", "PATCH", "DELETE"))
        require(path.startsWith("/api/v1/users/me/addresses") && !path.contains(".."))
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage shipping addresses.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedAddressResponse).orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message").takeIf(String::isNotBlank) }.getOrNull()
                    ?: "Shipping address request failed (HTTP $status). Try again."
                throw ShippingAddressHttpException(status, message)
            }
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

private fun readBoundedAddressResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        require(output.size() + count <= 1_048_576) { "Nantty returned an unexpectedly large address response." }
        output.write(buffer, 0, count)
    }
    return output.toString(Charsets.UTF_8.name())
}

private fun normalizeAddressPhone(value: String): String = value.trim().filterNot { it in " -()." }
