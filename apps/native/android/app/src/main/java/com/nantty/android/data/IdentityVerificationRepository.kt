package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class IdentityEligibility(
    val state: String,
    val tier: String,
    val trustScore: Int,
    val reasons: List<String>,
    val canBuyNow: Boolean,
    val requestedAt: String?,
    val nextCheckAt: String?,
)

data class IdentityVerificationCase(
    val id: String,
    val color: String,
    val planCode: String,
    val paymentChannel: String,
    val status: String,
    val refundStatus: String,
    val refundMethod: String,
    val refundScope: String,
    val consentGiven: Boolean,
    val decisionReason: String,
    val createdAt: String,
    val decidedAt: String?,
    val verifiedAt: String?,
    val canRetry: Boolean,
)

data class IdentityVerificationJourney(
    val profileId: String,
    val profileType: String,
    val color: String,
    val blackVetting: Boolean,
    val planCode: String,
    val consentVersion: String,
    val eligibility: IdentityEligibility?,
    val case: IdentityVerificationCase?,
    val checkmark: IdentityCheckmark?,
)

data class IdentityCheckmark(val color: String, val status: String, val badgeVisible: Boolean)
data class IdentityDocumentTypes(val country: String, val documentTypes: List<String>, val governmentLookup: Boolean)
data class IdentityCaptureSession(val mode: String, val url: String?, val token: String?, val product: String, val jobId: String)
data class IdentityCaptureRequest(
    val consentVersion: String,
    val consentAccepted: Boolean,
    val platform: String,
    val documentCountry: String,
    val documentType: String,
)

sealed interface IdentityVerificationResult<out T> {
    data class Success<T>(val value: T) : IdentityVerificationResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : IdentityVerificationResult<Nothing>
}

interface IdentityVerificationTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun post(path: String, accessToken: String, body: JSONObject): JSONObject
}

/** Implements the identity-check endpoints used by the React Native identity verification journey. */
class IdentityVerificationRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: IdentityVerificationTransport = JdkIdentityVerificationTransport(baseUrl),
) {
    fun loadJourney(): IdentityVerificationResult<IdentityVerificationJourney> = requestResult {
        authenticated { token -> transport.get(JOURNEY_PATH, token) }.let(::parseIdentityJourney)
    }

    fun requestEligibility(): IdentityVerificationResult<IdentityEligibility> = requestResult {
        val response = authenticated { token -> transport.post(ELIGIBILITY_REQUEST_PATH, token, JSONObject()) }
        parseIdentityEligibility(response.identityData())
    }

    fun loadDocumentTypes(country: String): IdentityVerificationResult<IdentityDocumentTypes> = requestResult {
        require(country.matches(COUNTRY_CODE)) { "Choose a valid document country." }
        val response = authenticated { token -> transport.get("$DOCUMENT_TYPES_PATH?country=$country", token) }
        parseIdentityDocumentTypes(response)
    }

    fun startCapture(caseId: String, request: IdentityCaptureRequest): IdentityVerificationResult<IdentityCaptureSession> = requestResult {
        require(caseId.matches(SAFE_CASE_ID)) { "This verification case is invalid." }
        require(request.consentVersion.isNotBlank() && request.consentAccepted) { "Accept the identity-check consent to continue." }
        require(request.platform in setOf("android", "ios")) { "This platform is not supported." }
        require(request.documentCountry.matches(COUNTRY_CODE) && request.documentType.matches(DOCUMENT_CODE)) { "Choose a valid identity document." }
        val body = JSONObject()
            .put("consentVersion", request.consentVersion)
            .put("consentAccepted", request.consentAccepted)
            .put("platform", request.platform)
            .put("documentCountry", request.documentCountry)
            .put("documentType", request.documentType)
        val response = authenticated { token -> transport.post("$CASES_PATH/${caseId}/capture", token, body) }
        parseIdentityCaptureSession(response.identityData())
    }

    private fun <T> requestResult(block: () -> T): IdentityVerificationResult<T> = try {
        IdentityVerificationResult.Success(block())
    } catch (error: IdentityVerificationHttpException) {
        IdentityVerificationResult.Failure(
            error.message ?: "Identity verification could not be loaded. Try again.",
            authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
        )
    } catch (error: Exception) {
        IdentityVerificationResult.Failure(error.message ?: "Identity verification could not be loaded. Check your connection and try again.")
    }

    private fun <T> authenticated(block: (String) -> T): T {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: throw IdentityVerificationHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to verify your identity.")
        return try {
            block(session.accessToken)
        } catch (error: IdentityVerificationHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw IdentityVerificationHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
            block(refreshed)
        }
    }

    companion object {
        const val JOURNEY_PATH = "/api/v1/verification/journey"
        const val ELIGIBILITY_REQUEST_PATH = "/api/v1/verification/eligibility/request"
        const val DOCUMENT_TYPES_PATH = "/api/v1/verification/document-types"
        const val CASES_PATH = "/api/v1/verification/cases"
        private val SAFE_CASE_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
        private val COUNTRY_CODE = Regex("^[A-Z]{2}$")
        private val DOCUMENT_CODE = Regex("^[A-Z0-9_-]{1,64}$")
    }
}

internal class IdentityVerificationHttpException(val statusCode: Int, message: String? = null) : Exception(message ?: "Identity verification request failed (HTTP $statusCode).")

internal class JdkIdentityVerificationTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : IdentityVerificationTransport {
    override fun get(path: String, accessToken: String): JSONObject = execute("GET", path, accessToken, null)
    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject = execute("POST", path, accessToken, body)

    private fun execute(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to verify your identity." }
        require(path.startsWith("/api/v1/verification/") && !path.contains("..")) { "Unsupported identity verification request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to verify your identity.")
        val connection = openConnection(URL(origin + path)).apply {
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
            }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.use(::readBoundedResponse).orEmpty()
            if (status !in 200..299) throw IdentityVerificationHttpException(status, extractErrorMessage(text, status))
            if (text.isBlank()) error("Nantty returned an empty identity verification response.")
            return JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large identity verification response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private fun extractErrorMessage(response: String, status: Int): String = runCatching {
        val root = JSONObject(response).identityData()
        root.optJSONObject("error")?.optString("message")?.takeIf(String::isNotBlank)
            ?: root.optString("message").takeIf(String::isNotBlank)
            ?: "Identity verification request failed (HTTP $status)."
    }.getOrDefault("Identity verification request failed (HTTP $status).")

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

internal fun parseIdentityJourney(response: JSONObject): IdentityVerificationJourney {
    val root = response.identityData()
    return IdentityVerificationJourney(
        profileId = root.optString("profileId"),
        profileType = root.optString("profileType"),
        color = root.optString("color"),
        blackVetting = root.optBoolean("blackVetting"),
        planCode = root.optString("planCode"),
        consentVersion = root.optString("consentVersion"),
        eligibility = root.optJSONObject("eligibility")?.let(::parseIdentityEligibility),
        case = root.optJSONObject("case")?.let(::parseIdentityCase),
        checkmark = root.optJSONObject("checkmark")?.let {
            IdentityCheckmark(it.optString("color"), it.optString("status"), it.optBoolean("badgeVisible"))
        },
    )
}

internal fun parseIdentityEligibility(root: JSONObject): IdentityEligibility {
    val reasons = root.optJSONArray("reasons") ?: JSONArray()
    return IdentityEligibility(
        state = root.optString("state"), tier = root.optString("tier"), trustScore = root.optInt("trustScore"),
        reasons = buildList { for (index in 0 until reasons.length()) reasons.optString(index).takeIf(String::isNotBlank)?.let(::add) },
        canBuyNow = root.optBoolean("canBuyNow"), requestedAt = root.optNullableIdentityString("requestedAt"), nextCheckAt = root.optNullableIdentityString("nextCheckAt"),
    )
}

internal fun parseIdentityDocumentTypes(response: JSONObject): IdentityDocumentTypes {
    val root = response.identityData()
    val rows = root.optJSONArray("documentTypes") ?: JSONArray()
    return IdentityDocumentTypes(
        country = root.optString("country"),
        documentTypes = buildList { for (index in 0 until rows.length()) rows.optString(index).takeIf { it.matches(Regex("^[A-Z0-9_-]{1,64}$")) }?.let(::add) },
        governmentLookup = root.optBoolean("governmentLookup"),
    )
}

internal fun parseIdentityCaptureSession(response: JSONObject): IdentityCaptureSession {
    val mode = response.optString("mode").takeIf { it in setOf("hosted_link", "web_integration") }
        ?: error("Nantty returned an unsupported identity capture mode.")
    val url = response.optNullableIdentityString("url")?.also { require(isSafeIdentityCaptureUrl(it)) { "Nantty returned an unsafe identity capture URL." } }
    val token = response.optNullableIdentityString("token")
    require((mode == "hosted_link" && url != null) || (mode == "web_integration" && !token.isNullOrBlank())) {
        "Nantty returned an incomplete identity capture session."
    }
    return IdentityCaptureSession(mode, url, token, response.optString("product"), response.optString("jobId"))
}

private fun parseIdentityCase(root: JSONObject) = IdentityVerificationCase(
    id = root.optString("id"), color = root.optString("color"), planCode = root.optString("planCode"), paymentChannel = root.optString("paymentChannel"),
    status = root.optString("status"), refundStatus = root.optString("refundStatus"), refundMethod = root.optString("refundMethod"), refundScope = root.optString("refundScope"),
    consentGiven = root.optBoolean("consentGiven"), decisionReason = root.optString("decisionReason"), createdAt = root.optString("createdAt"),
    decidedAt = root.optNullableIdentityString("decidedAt"), verifiedAt = root.optNullableIdentityString("verifiedAt"), canRetry = root.optBoolean("canRetry"),
)

private fun JSONObject.identityData(): JSONObject = optJSONObject("data") ?: this
private fun JSONObject.optNullableIdentityString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
private fun isSafeIdentityCaptureUrl(raw: String): Boolean = runCatching {
    val url = URI(raw)
    url.scheme == "https" && !url.host.isNullOrBlank() && url.userInfo == null
}.getOrDefault(false)
