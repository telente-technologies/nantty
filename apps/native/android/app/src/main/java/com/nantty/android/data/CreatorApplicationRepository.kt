package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class CreatorApplicationSocialLink(val platform: String, val url: String)

data class CreatorApplicationSubmission(
    val contentCategories: List<String>,
    val socialLinks: List<CreatorApplicationSocialLink>,
    val sampleContentUrls: List<String>,
    val payoutAccountId: String?,
    val acceptedCreatorTermsVersion: String,
)

/** Public payout-account fields returned by the mobile wallet list contract. */
data class CreatorPayoutAccount(
    val id: String,
    val bankName: String,
    val accountNumberMasked: String,
    val accountName: String,
)

sealed interface CreatorPayoutAccountsResult {
    data class Success(val accounts: List<CreatorPayoutAccount>) : CreatorPayoutAccountsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CreatorPayoutAccountsResult
}

fun interface CreatorApplicationTransport {
    fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

fun interface CreatorPayoutAccountsTransport {
    fun get(path: String, accessToken: String): JSONObject
}

/** Authenticated Creator Program submission using the same request contract as the mobile client. */
class CreatorApplicationRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CreatorApplicationTransport = JdkCreatorApplicationTransport(baseUrl),
    private val payoutAccountsTransport: CreatorPayoutAccountsTransport = JdkCreatorPayoutAccountsTransport(baseUrl),
) {
    fun listPayoutAccounts(): CreatorPayoutAccountsResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return CreatorPayoutAccountsResult.Failure("Sign in to view payout accounts.", authenticationRequired = true)
        val payload = try {
            payoutAccountsTransport.get(PAYOUT_ACCOUNTS_PATH, session.accessToken)
        } catch (error: CreatorWorkspaceHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: return CreatorPayoutAccountsResult.Failure("Your session has expired. Sign in again.", authenticationRequired = true)
            payoutAccountsTransport.get(PAYOUT_ACCOUNTS_PATH, refreshed)
        }
        val rows = payload.optJSONArray("data")
            ?: error("Nantty returned an incomplete payout account list.")
        val accounts = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index)
                    ?: error("Nantty returned an invalid payout account.")
                add(
                    CreatorPayoutAccount(
                        id = row.requiredPayoutAccountString("id"),
                        bankName = row.requiredPayoutAccountString("bankName"),
                        accountNumberMasked = row.requiredPayoutAccountString("accountNumberMasked"),
                        accountName = row.requiredPayoutAccountString("accountName"),
                    ),
                )
            }
        }
        CreatorPayoutAccountsResult.Success(accounts)
    } catch (error: Exception) {
        CreatorPayoutAccountsResult.Failure(
            error.message ?: "Could not load payout accounts. Check your connection and try again.",
            authenticationRequired = error is CreatorWorkspaceHttpException && error.statusCode in setOf(401, 403),
        )
    }

    fun submit(submission: CreatorApplicationSubmission, idempotencyKey: String): CreatorWorkspaceResult<CreatorApplication> = try {
        require(idempotencyKey.isNotBlank()) { "Retry the application submission." }
        require(submission.contentCategories.isNotEmpty() && submission.contentCategories.size <= MAX_CATEGORIES) {
            "Choose between one and $MAX_CATEGORIES content categories."
        }
        require(submission.contentCategories.distinct().size == submission.contentCategories.size) { "Remove duplicate content categories." }
        require(submission.sampleContentUrls.size <= MAX_SAMPLE_IMAGES) { "Choose up to $MAX_SAMPLE_IMAGES sample images." }
        require(submission.acceptedCreatorTermsVersion.isNotBlank()) { "Accept the Creator Terms to continue." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return CreatorWorkspaceResult.Failure("Sign in to submit a creator application.", authenticationRequired = true)
        val body = JSONObject()
            .put("contentCategories", JSONArray(submission.contentCategories))
            .put("socialLinks", JSONArray().apply {
                submission.socialLinks.forEach { link ->
                    put(JSONObject().put("platform", link.platform).put("url", link.url))
                }
            })
            .put("sampleContentUrls", JSONArray(submission.sampleContentUrls))
            .put("acceptedCreatorTermsVersion", submission.acceptedCreatorTermsVersion)
        submission.payoutAccountId?.takeIf(String::isNotBlank)?.let { body.put("payoutAccountId", it) }

        val payload = try {
            transport.post(APPLICATION_SUBMIT_PATH, session.accessToken, idempotencyKey, body)
        } catch (error: CreatorWorkspaceHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: return CreatorWorkspaceResult.Failure("Your session has expired. Sign in again.", authenticationRequired = true)
            transport.post(APPLICATION_SUBMIT_PATH, refreshed, idempotencyKey, body)
        }
        CreatorWorkspaceResult.Success(parseCreatorApplication(payload)
            ?: error("Nantty returned an incomplete creator application response."))
    } catch (error: Exception) {
        CreatorWorkspaceResult.Failure(
            error.message ?: "Your application could not be submitted. Check your connection and try again.",
            authenticationRequired = error is CreatorWorkspaceHttpException && error.statusCode in setOf(401, 403),
        )
    }

    companion object {
        const val APPLICATION_SUBMIT_PATH = "/api/v1/creators/applications"
        const val PAYOUT_ACCOUNTS_PATH = "/api/v1/wallets/me/payout-accounts"
        const val MAX_CATEGORIES = 3
        const val MAX_SAMPLE_IMAGES = 3
    }
}

internal class JdkCreatorPayoutAccountsTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : CreatorPayoutAccountsTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path == CreatorApplicationRepository.PAYOUT_ACCOUNTS_PATH) { "Unsupported payout account request." }
        require(accessToken.isNotBlank()) { "Sign in to view payout accounts." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view payout accounts.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readPayoutAccountsResponse).orEmpty()
            if (status !in 200..299) throw CreatorWorkspaceHttpException(status)
            if (response.isBlank()) error("Nantty returned an empty payout account response.")
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readPayoutAccountsResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large payout account response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

private fun JSONObject.requiredPayoutAccountString(key: String): String =
    optString(key).takeIf { it.isNotBlank() && it != "null" }
        ?: error("Nantty returned an incomplete payout account.")

internal class JdkCreatorApplicationTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : CreatorApplicationTransport {
    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        require(path == CreatorApplicationRepository.APPLICATION_SUBMIT_PATH) { "Unsupported creator application request." }
        require(accessToken.isNotBlank() && idempotencyKey.isNotBlank()) { "Sign in to submit a creator application." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to submit a creator application.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 20_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readCreatorResponse).orEmpty()
            if (status !in 200..299) throw CreatorWorkspaceHttpException(status)
            if (response.isBlank()) error("Nantty returned an empty creator application response.")
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readCreatorResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large creator application response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}
