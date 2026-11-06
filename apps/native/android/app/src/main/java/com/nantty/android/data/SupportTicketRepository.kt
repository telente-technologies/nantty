package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class SupportLinkedReference(
    val kind: String,
    val id: String,
    val label: String,
)

internal data class SupportTicketMessage(
    val id: String,
    val fromSupport: Boolean,
    val authorName: String,
    val text: String,
    val attachmentUrls: List<String>,
    val createdAt: String,
)

internal data class SupportTicketDetail(
    val id: String,
    val reference: String?,
    val subject: String,
    val category: String,
    val status: String,
    val linkedReference: SupportLinkedReference?,
    val unreadCount: Int,
    val canRate: Boolean,
    val canReply: Boolean,
    val satisfactionScore: Int?,
    val messages: List<SupportTicketMessage>,
    val agentTyping: Boolean,
)

internal data class SupportTicketSummary(
    val id: String,
    val reference: String?,
    val subject: String,
    val category: String,
    val status: String,
    val linkedReference: SupportLinkedReference?,
    val lastMessagePreview: String,
    val unreadCount: Int,
    val satisfactionScore: Int?,
    val canRate: Boolean,
    val canReply: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

internal sealed interface SupportTicketResult<out T> {
    data class Success<T>(val value: T) : SupportTicketResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SupportTicketResult<Nothing>
}

internal interface SupportTicketTransport {
    fun request(
        method: String,
        path: String,
        accessToken: String,
        body: JSONObject?,
        idempotencyKey: String?,
    ): JSONObject
}

internal class SupportTicketRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: SupportTicketTransport = JdkSupportTicketTransport(baseUrl),
) {
    fun listMyTickets(): SupportTicketResult<List<SupportTicketSummary>> =
        requestResult("GET", TICKETS_PATH, null, null) { payload ->
            val rows = payload.optJSONArray("data") ?: payload.optJSONArray("items")
                ?: error("Nantty returned an incomplete support request list.")
            buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    add(parseSummary(row))
                }
            }
        }

    fun unreadCount(): SupportTicketResult<Int> =
        requestResult("GET", UNREAD_COUNT_PATH, null, null) { payload ->
            require(payload.has("count") && payload.opt("count") is Number) { "Nantty returned an invalid unread support count." }
            payload.optInt("count").coerceAtLeast(0)
        }

    fun createTicket(
        category: String,
        subject: String,
        message: String,
        linkedReference: SupportLinkedReference? = null,
        attachmentUrls: List<String> = emptyList(),
        idempotencyKey: String,
    ): SupportTicketResult<SupportTicketDetail> {
        if (!isSupportedCategory(category) || !isValidText(subject, MIN_SUBJECT_LENGTH, MAX_CREATE_SUBJECT_LENGTH) ||
            !isValidText(message, MIN_MESSAGE_LENGTH, MAX_CREATE_MESSAGE_LENGTH) || attachmentUrls.size > MAX_ATTACHMENTS ||
            attachmentUrls.any { !it.isValidHttpsUrl() } || !idempotencyKey.matches(IDEMPOTENCY_KEY_PATTERN) ||
            linkedReference?.let(::isValidReference) == false
        ) return SupportTicketResult.Failure("Check the support request details and try again.")

        val body = JSONObject()
            .put("category", category)
            .put("subject", subject.trim())
            .put("message", message.trim())
            .put("attachmentUrls", JSONArray(attachmentUrls))
            .put("linkedReference", linkedReference?.toJson() ?: JSONObject.NULL)
        return requestResult("POST", TICKETS_PATH, body, idempotencyKey, ::parseDetail)
    }

    fun loadTicket(ticketId: String): SupportTicketResult<SupportTicketDetail> {
        if (!ticketId.matches(UUID_PATTERN)) return SupportTicketResult.Failure("That support request could not be found.")
        return requestResult("GET", "$TICKETS_PATH/$ticketId", null, null, ::parseDetail)
    }

    fun markRead(ticketId: String): SupportTicketResult<Unit> {
        if (!ticketId.matches(UUID_PATTERN)) return SupportTicketResult.Failure("That support request could not be found.")
        return requestResult("POST", "$TICKETS_PATH/$ticketId/read", JSONObject(), null) { Unit }
    }

    fun rateTicket(ticketId: String, score: Int, comment: String? = null): SupportTicketResult<Unit> {
        if (!ticketId.matches(UUID_PATTERN) || score !in 1..5 || (comment?.length ?: 0) > MAX_RATING_COMMENT_LENGTH) {
            return SupportTicketResult.Failure("Choose a rating from 1 to 5 and try again.")
        }
        val body = JSONObject().put("score", score).put("comment", comment?.trim()?.takeIf(String::isNotBlank) ?: JSONObject.NULL)
        return requestResult("POST", "$TICKETS_PATH/$ticketId/rating", body, null) { Unit }
    }

    fun reply(
        ticketId: String,
        text: String,
        idempotencyKey: String,
    ): SupportTicketResult<Unit> {
        if (!ticketId.matches(UUID_PATTERN) || !isValidText(text, 1, MAX_MESSAGE_LENGTH) ||
            !idempotencyKey.matches(IDEMPOTENCY_KEY_PATTERN)
        ) return SupportTicketResult.Failure("Check your reply and try again.")
        val body = JSONObject().put("text", text.trim()).put("attachmentUrls", JSONArray())
        return requestResult("POST", "$TICKETS_PATH/$ticketId/messages", body, idempotencyKey) { Unit }
    }

    private fun <T> requestResult(
        method: String,
        path: String,
        body: JSONObject?,
        idempotencyKey: String?,
        parse: (JSONObject) -> T,
    ): SupportTicketResult<T> {
        val session = sessionProvider()
            ?: return SupportTicketResult.Failure("Sign in to contact Nantty Support.", authenticationRequired = true)
        val token = session.accessToken.takeIf(String::isNotBlank)
            ?: return SupportTicketResult.Failure("Sign in to contact Nantty Support.", authenticationRequired = true)
        return try {
            val payload = requestWithRefresh(method, path, body, idempotencyKey, token)
            SupportTicketResult.Success(parse(payload.optJSONObject("data") ?: payload))
        } catch (error: SupportTicketHttpException) {
            SupportTicketResult.Failure(
                message = when (error.statusCode) {
                    HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> "Your session has expired. Sign in again to contact support."
                    HttpURLConnection.HTTP_NOT_FOUND -> "That support request could not be found."
                    HttpURLConnection.HTTP_CONFLICT -> "This request changed. Refresh and try again."
                    else -> "Support request failed (HTTP ${error.statusCode}). Please try again."
                },
                authenticationRequired = error.statusCode in AUTH_REQUIRED_STATUS_CODES,
            )
        } catch (error: Exception) {
            SupportTicketResult.Failure(error.message ?: "Could not contact support. Check your connection and try again.")
        }
    }

    private fun requestWithRefresh(method: String, path: String, body: JSONObject?, key: String?, accessToken: String): JSONObject {
        return try {
            transport.request(method, path, accessToken, body, key)
        } catch (error: SupportTicketHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw SupportTicketHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            transport.request(method, path, refreshed, body, key)
        }
    }

    private fun parseDetail(value: JSONObject): SupportTicketDetail {
        val id = value.optString("id")
        require(id.matches(UUID_PATTERN)) { "Nantty returned an invalid support request." }
        val subject = value.optString("subject").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete support request.")
        val category = value.optString("category")
        require(isSupportedCategory(category)) { "Nantty returned an unsupported support category." }
        val status = value.optString("status")
        require(status in TICKET_STATUSES) { "Nantty returned an unsupported support status." }
        val messages = value.optJSONArray("messages")
            ?: error("Nantty returned an incomplete support conversation.")
        return SupportTicketDetail(
            id = id,
            reference = value.optNullableString("reference"),
            subject = subject.take(MAX_SUBJECT_LENGTH),
            category = category,
            status = status,
            linkedReference = value.optJSONObject("linkedReference")?.let(::parseLinkedReference),
            unreadCount = value.optInt("unreadCount").coerceAtLeast(0),
            canRate = value.optBoolean("canRate"),
            canReply = value.optBoolean("canReply"),
            satisfactionScore = value.optInt("satisfactionScore").takeIf { value.opt("satisfactionScore") is Number && it in 1..5 },
            messages = parseMessages(messages),
            agentTyping = value.optBoolean("agentTyping"),
        )
    }

    private fun parseSummary(value: JSONObject): SupportTicketSummary {
        val id = value.optString("id")
        require(id.matches(UUID_PATTERN)) { "Nantty returned an invalid support request." }
        val subject = value.optString("subject").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete support request.")
        val category = value.optString("category")
        require(isSupportedCategory(category)) { "Nantty returned an unsupported support category." }
        val status = value.optString("status")
        require(status in TICKET_STATUSES) { "Nantty returned an unsupported support status." }
        return SupportTicketSummary(
            id = id,
            reference = value.optNullableString("reference"),
            subject = subject.take(MAX_SUBJECT_LENGTH),
            category = category,
            status = status,
            linkedReference = value.optJSONObject("linkedReference")?.let(::parseLinkedReference),
            lastMessagePreview = value.optString("lastMessagePreview").filterNot(Char::isISOControl).take(MAX_PREVIEW_LENGTH),
            unreadCount = value.optInt("unreadCount").coerceAtLeast(0),
            satisfactionScore = value.optInt("satisfactionScore").takeIf { value.opt("satisfactionScore") is Number && it in 1..5 },
            canRate = value.optBoolean("canRate"),
            canReply = value.optBoolean("canReply"),
            createdAt = value.optString("createdAt").takeIf(String::isNotBlank).orEmpty(),
            updatedAt = value.optString("updatedAt").takeIf(String::isNotBlank).orEmpty(),
        )
    }

    private fun parseMessages(rows: JSONArray): List<SupportTicketMessage> = buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id").takeIf(String::isNotBlank) ?: continue
            val author = row.optString("authorName").takeIf(String::isNotBlank) ?: "Nantty Support"
            val attachments = row.optJSONArray("attachmentUrls") ?: JSONArray()
            add(
                SupportTicketMessage(
                    id = id,
                    fromSupport = row.optBoolean("fromSupport"),
                    authorName = author.take(MAX_AUTHOR_LENGTH),
                    text = row.optString("text").filterNot(Char::isISOControl).take(MAX_MESSAGE_LENGTH),
                    attachmentUrls = buildList {
                        for (attachmentIndex in 0 until attachments.length()) {
                            attachments.optString(attachmentIndex).takeIf(String::isValidHttpsUrl)?.let(::add)
                        }
                    }.take(MAX_ATTACHMENTS),
                    createdAt = row.optString("createdAt").takeIf(String::isNotBlank).orEmpty(),
                ),
            )
        }
    }

    private fun parseLinkedReference(value: JSONObject): SupportLinkedReference {
        val kind = value.optString("kind")
        val id = value.optString("id")
        val label = value.optString("label")
        require(kind in LINKED_REFERENCE_KINDS && id.length in 1..MAX_REFERENCE_ID_LENGTH && label.length in 1..MAX_REFERENCE_LABEL_LENGTH) {
            "Nantty returned an invalid linked support reference."
        }
        return SupportLinkedReference(kind, id, label.filterNot(Char::isISOControl))
    }

    private fun isValidReference(value: SupportLinkedReference): Boolean =
        value.kind in LINKED_REFERENCE_KINDS && value.id.matches(REFERENCE_ID_PATTERN) &&
            value.label.length in 1..MAX_REFERENCE_LABEL_LENGTH && value.label.none(Char::isISOControl)

    private fun SupportLinkedReference.toJson(): JSONObject = JSONObject().put("kind", kind).put("id", id).put("label", label)

    companion object {
        const val TICKETS_PATH = "/api/v1/support/tickets"
        const val UNREAD_COUNT_PATH = "/api/v1/support/tickets/unread-count"
        const val MIN_SUBJECT_LENGTH = 4
        const val MAX_CREATE_SUBJECT_LENGTH = 80
        private const val MAX_SUBJECT_LENGTH = 120
        const val MIN_MESSAGE_LENGTH = 10
        const val MAX_CREATE_MESSAGE_LENGTH = 1_500
        private const val MAX_MESSAGE_LENGTH = 5_000
        const val MAX_ATTACHMENTS = 5
        private const val MAX_AUTHOR_LENGTH = 120
        private const val MAX_REFERENCE_ID_LENGTH = 80
        private const val MAX_REFERENCE_LABEL_LENGTH = 120
        private const val MAX_RATING_COMMENT_LENGTH = 1_000
        private const val MAX_PREVIEW_LENGTH = 500
        private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")
        private val IDEMPOTENCY_KEY_PATTERN = Regex("[A-Za-z0-9_-]{8,128}")
        private val REFERENCE_ID_PATTERN = Regex("[A-Za-z0-9_-]{1,80}")
        private val TICKET_STATUSES = setOf("open", "awaiting_you", "awaiting_support", "resolved", "closed")
        private val LINKED_REFERENCE_KINDS = setOf("order", "payment", "live", "report", "dispute")
        private val TICKET_CATEGORIES = setOf("order", "payment", "account", "seller", "verification", "creator", "live", "ads", "safety", "other")
        private val AUTH_REQUIRED_STATUS_CODES = setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)

        private fun isSupportedCategory(value: String) = value in TICKET_CATEGORIES
        private fun isValidText(value: String, min: Int, max: Int): Boolean = value.trim().length in min..max
    }
}

private class JdkSupportTicketTransport(private val baseUrl: String) : SupportTicketTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
        require(path == SupportTicketRepository.TICKETS_PATH || path == SupportTicketRepository.UNREAD_COUNT_PATH || path.matches(TICKET_PATH_PATTERN)) { "Unsupported support request." }
        require(method in setOf("GET", "POST")) { "Unsupported support operation." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to contact support.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
        }
        try {
            body?.let { connection.outputStream.use { output -> output.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val responseBody = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw SupportTicketHttpException(status)
            if (responseBody.isBlank()) return JSONObject()
            return if (responseBody.trimStart().startsWith('[')) {
                JSONObject().put("data", JSONArray(responseBody))
            } else {
                JSONObject(responseBody)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large support response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val READ_TIMEOUT_MS = 15_000
        private const val MAX_RESPONSE_BYTES = 1_048_576
        private val TICKET_PATH_PATTERN = Regex("/api/v1/support/tickets/[0-9a-fA-F-]{36}(/(read|messages|rating))?")
    }
}

internal class SupportTicketHttpException(val statusCode: Int) : IllegalStateException("Support request failed (HTTP $statusCode).")

private fun String.isValidHttpsUrl(): Boolean = runCatching {
    val parsed = URL(this)
    parsed.protocol == "https" && parsed.host.isNotBlank() && parsed.userInfo == null
}.getOrDefault(false)

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
