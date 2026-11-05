package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.math.BigDecimal
import java.util.UUID

internal data class DisputeMoney(val amountMinor: Long, val currency: String)

internal data class DisputeShipment(
    val courierName: String,
    val trackingNumber: String,
    val trackingUrl: String?,
    val shippedAt: String,
    val estimatedDeliveryAt: String?,
)

internal data class OrderEscrowDetail(
    val escrowId: String,
    val orderId: String,
    val orderReference: String,
    val stage: String,
    val status: String,
    val heldAmount: DisputeMoney,
    val platformFee: DisputeMoney,
    val sellerPayoutAmount: DisputeMoney,
    val refundedAmount: DisputeMoney,
    val buyerId: String,
    val storeId: String,
    val sellerUserId: String,
    val paidAt: String?,
    val preparingSince: String?,
    val shipment: DisputeShipment?,
    val deliveredAt: String?,
    val buyerConfirmedAt: String?,
    val autoReleaseAt: String?,
    val expectedReleaseAt: String?,
    val releasedAt: String?,
    val refundedAt: String?,
    val disputeId: String?,
    val undeliveredReviewAt: String?,
    val feesKeptOnRefund: DisputeMoney,
)

internal data class DisputeStatusEvent(val status: String, val label: String, val occurredAt: String)

internal data class DisputeMessage(
    val id: String,
    val authorRole: String,
    val authorName: String,
    val authorAvatarUrl: String?,
    val text: String,
    val attachmentUrls: List<String>,
    val createdAt: String,
)

internal data class BuyerDispute(
    val id: String,
    val orderId: String,
    val orderReference: String,
    val productName: String,
    val amount: DisputeMoney,
    val reason: String,
    val description: String,
    val evidenceUrls: List<String>,
    val status: String,
    val viewerRole: String,
    val counterpartyName: String,
    val openedAt: String,
    val respondByAt: String?,
    val resolutionNote: String?,
    val statusHistory: List<DisputeStatusEvent>,
    val messages: List<DisputeMessage>,
)

internal sealed interface DisputeRepositoryResult<out T> {
    data class Success<T>(val value: T) : DisputeRepositoryResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : DisputeRepositoryResult<Nothing>
}

internal interface DisputeTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

internal class DisputeRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: DisputeTransport = JdkDisputeTransport(baseUrl),
) {
    fun loadEscrowForOrder(orderId: String): DisputeRepositoryResult<OrderEscrowDetail> =
        execute("view this order's payment protection") { token ->
            requireSafeOrderId(orderId)
            parseEscrow(transport.get("/api/v1/orders/$orderId/escrow", token), orderId)
        }

    fun loadDispute(disputeId: String): DisputeRepositoryResult<BuyerDispute> =
        execute("view this dispute") { token ->
            requireSafeDisputeId(disputeId)
            parseDispute(transport.get("/api/v1/disputes/$disputeId", token))
        }

    fun openDispute(
        orderId: String,
        reason: String,
        description: String,
        evidenceUrls: List<String>,
        idempotencyKey: String,
    ): DisputeRepositoryResult<BuyerDispute> = execute("open a dispute") { token ->
        requireSafeOrderId(orderId)
        require(reason in DISPUTE_REASONS) { "Choose a valid reason for this dispute." }
        require(description.toByteArray(Charsets.UTF_8).size <= MAX_TEXT_LENGTH) { "The dispute description is too long." }
        validateHttpsUrls(evidenceUrls, "Evidence")
        requireSafeIdempotencyKey(idempotencyKey)
        val body = JSONObject()
            .put("reason", reason)
            .put("description", description)
            .put("evidenceUrls", JSONArray(evidenceUrls))
        parseDispute(transport.post("/api/v1/orders/$orderId/disputes", token, idempotencyKey, body))
    }

    fun sendDisputeMessage(
        disputeId: String,
        text: String,
        attachmentUrls: List<String>,
        idempotencyKey: String,
    ): DisputeRepositoryResult<DisputeMessage> = execute("send a dispute message") { token ->
        requireSafeDisputeId(disputeId)
        val textBytes = text.toByteArray(Charsets.UTF_8).size
        require(text.trim().isNotEmpty() && textBytes in 1..MAX_TEXT_LENGTH) {
            "Enter a message of up to $MAX_TEXT_LENGTH characters."
        }
        validateHttpsUrls(attachmentUrls, "Attachments")
        requireSafeIdempotencyKey(idempotencyKey)
        val body = JSONObject().put("text", text).put("attachmentUrls", JSONArray(attachmentUrls))
        parseMessage(transport.post("/api/v1/disputes/$disputeId/messages", token, idempotencyKey, body))
    }

    private inline fun <T> execute(action: String, request: (String) -> T): DisputeRepositoryResult<T> {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return DisputeRepositoryResult.Failure("Sign in to $action.", authenticationRequired = true)
        return try {
            DisputeRepositoryResult.Success(request(session.accessToken))
        } catch (error: Exception) {
            val httpError = error as? DisputeHttpException
            val authRequired = httpError?.statusCode == 401 || httpError?.statusCode == 403
            DisputeRepositoryResult.Failure(
                when {
                    authRequired -> "Your session has expired. Sign in again to $action."
                    httpError?.statusCode == 404 -> "This order or dispute could not be found."
                    httpError?.statusCode == 409 || httpError?.statusCode == 422 -> "This action is no longer available. Refresh and try again."
                    httpError != null -> "Couldn't $action. Please try again."
                    error.message?.startsWith("Sign in") == true -> error.message!!
                    else -> error.message ?: "Couldn't $action. Check your connection and try again."
                },
                authenticationRequired = authRequired,
            )
        }
    }

    internal fun parseEscrow(payload: JSONObject, expectedOrderId: String): OrderEscrowDetail {
        val value = unwrapDisputeObject(payload)
        val escrowId = value.requiredSafeId("escrowId")
        val orderId = value.requiredSafeId("orderId")
        require(orderId == expectedOrderId) { "Nantty returned escrow details for a different order." }
        val stage = value.requiredString("stage")
        require(stage in ESCROW_STAGES) { "Nantty returned an unknown escrow stage." }
        val disputeId = value.nullableString("disputeId")?.also(::requireSafeDisputeId)
        val shipmentValue = value.opt("shipment")
        val shipment = when (shipmentValue) {
            null, JSONObject.NULL -> null
            is JSONObject -> DisputeShipment(
                courierName = shipmentValue.requiredString("courierName"),
                trackingNumber = shipmentValue.requiredString("trackingNumber"),
                trackingUrl = shipmentValue.nullableString("trackingUrl")?.let { url -> safeOptionalHttpsUrl(url) },
                shippedAt = shipmentValue.requiredString("shippedAt"),
                estimatedDeliveryAt = shipmentValue.nullableString("estimatedDeliveryAt"),
            )
            else -> error("Nantty returned invalid shipment details.")
        }
        return OrderEscrowDetail(
            escrowId = escrowId,
            orderId = orderId,
            orderReference = value.requiredString("orderReference"),
            stage = stage,
            status = value.requiredString("status"),
            heldAmount = value.requiredMoney("heldAmount"),
            platformFee = value.requiredMoney("platformFee"),
            sellerPayoutAmount = value.requiredMoney("sellerPayoutAmount"),
            refundedAmount = value.requiredMoney("refundedAmount"),
            buyerId = value.requiredSafeNestedId("buyer", "id"),
            storeId = value.requiredSafeNestedId("store", "id"),
            sellerUserId = value.requiredSafeId("sellerUserId"),
            paidAt = value.nullableString("paidAt"),
            preparingSince = value.nullableString("preparingSince"),
            shipment = shipment,
            deliveredAt = value.nullableString("deliveredAt"),
            buyerConfirmedAt = value.nullableString("buyerConfirmedAt"),
            autoReleaseAt = value.nullableString("autoReleaseAt"),
            expectedReleaseAt = value.nullableString("expectedReleaseAt"),
            releasedAt = value.nullableString("releasedAt"),
            refundedAt = value.nullableString("refundedAt"),
            disputeId = disputeId,
            undeliveredReviewAt = value.nullableString("undeliveredReviewAt"),
            feesKeptOnRefund = value.requiredMoney("feesKeptOnRefund"),
        )
    }

    internal fun parseDispute(payload: JSONObject): BuyerDispute {
        val value = unwrapDisputeObject(payload)
        val id = value.requiredSafeId("id")
        requireSafeDisputeId(id)
        val orderId = value.requiredSafeId("orderId")
        val reason = value.requiredString("reason")
        require(reason in DISPUTE_REASONS) { "Nantty returned an unknown dispute reason." }
        val viewerRole = value.requiredString("viewerRole")
        require(viewerRole == "buyer" || viewerRole == "seller") { "Nantty returned an unknown dispute role." }
        return BuyerDispute(
            id = id,
            orderId = orderId,
            orderReference = value.requiredString("orderReference"),
            productName = value.requiredString("productName"),
            amount = value.requiredMoney("amount"),
            reason = reason,
            description = value.requiredString("description"),
            evidenceUrls = value.requiredHttpsUrlArray("evidenceUrls"),
            status = value.requiredString("status").also { require(it in DISPUTE_STATUSES) },
            viewerRole = viewerRole,
            counterpartyName = value.requiredString("counterpartyName"),
            openedAt = value.requiredString("openedAt"),
            respondByAt = value.nullableString("respondByAt"),
            resolutionNote = value.nullableString("resolutionNote"),
            statusHistory = value.requiredObjectArray("statusHistory").map { event ->
                DisputeStatusEvent(
                    status = event.requiredString("status").also { require(it in DISPUTE_STATUSES) },
                    label = event.requiredString("label"),
                    occurredAt = event.requiredString("occurredAt"),
                )
            },
            messages = value.requiredObjectArray("messages").map(::parseMessageObject),
        )
    }

    internal fun parseMessage(payload: JSONObject): DisputeMessage = parseMessageObject(unwrapDisputeObject(payload))

    private fun parseMessageObject(value: JSONObject): DisputeMessage {
        val id = value.requiredSafeId("id")
        require(isCanonicalUuid(id)) { "Nantty returned an invalid dispute message ID." }
        val role = value.requiredString("authorRole")
        require(role in setOf("buyer", "seller", "support")) { "Nantty returned an unknown message author." }
        return DisputeMessage(
            id = id,
            authorRole = role,
            authorName = value.requiredString("authorName"),
            authorAvatarUrl = value.nullableHttpsUrl("authorAvatarUrl"),
            text = value.requiredString("text"),
            attachmentUrls = value.requiredHttpsUrlArray("attachmentUrls"),
            createdAt = value.requiredString("createdAt"),
        )
    }

    companion object {
        private const val MAX_TEXT_LENGTH = 2_000
        private val DISPUTE_REASONS = setOf("not_received", "not_as_described", "damaged", "wrong_item", "other")
        private val DISPUTE_STATUSES = setOf("open", "awaiting_seller", "under_review", "resolved_refunded", "resolved_released", "closed")
        private val ESCROW_STAGES = setOf("awaiting_payment", "paid_into_escrow", "seller_preparing", "shipped", "delivered", "buyer_confirmed", "released_to_seller", "disputed", "under_review", "refunded")
    }
}

internal fun buyerCanOpenDispute(
    orderStatus: String,
    directPayment: Boolean,
    escrow: OrderEscrowDetail?,
): Boolean = !directPayment &&
    orderStatus in setOf("paid", "shipped", "delivered") &&
    escrow != null &&
    escrow.disputeId == null &&
    escrow.stage in setOf("seller_preparing", "paid_into_escrow", "shipped", "delivered", "under_review")

private class JdkDisputeTransport(baseUrl: String) : DisputeTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun get(path: String, accessToken: String): JSONObject = request("GET", path, accessToken, null, null)

    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject =
        request("POST", path, accessToken, idempotencyKey, body)

    private fun request(method: String, path: String, accessToken: String, key: String?, body: JSONObject?): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to use disputes." }
        require(path.matches(Regex("/api/v1/orders/[A-Za-z0-9_-]{1,128}/escrow")) ||
            path.matches(Regex("/api/v1/orders/[A-Za-z0-9_-]{1,128}/disputes")) ||
            path.matches(Regex("/api/v1/disputes/[0-9a-fA-F-]{36}(/[a-z]+)?"))) { "Unsupported dispute request." }
        if (method == "POST") require(key != null && key.matches(IDEMPOTENCY_PATTERN) && body != null)
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to use buyer disputes.")
        val connection = (URL(apiOrigin + path).openConnection() as HttpURLConnection).apply {
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
                key?.let { setRequestProperty("Idempotency-Key", it) }
            }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw DisputeHttpException(status)
            val response = (connection.inputStream?.use(::readBoundedDisputeResponse)).orEmpty()
            require(response.isNotBlank()) { "Nantty returned an empty dispute response." }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        val IDEMPOTENCY_PATTERN = Regex("[A-Za-z0-9_-]{8,128}")
    }
}

internal class DisputeHttpException(val statusCode: Int) : Exception()

private fun readBoundedDisputeResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(4_096)
    while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        require(output.size() + count <= MAX_DISPUTE_RESPONSE_BYTES) { "Nantty returned an unexpectedly large dispute response." }
        output.write(buffer, 0, count)
    }
    return output.toString(Charsets.UTF_8.name())
}

private const val MAX_DISPUTE_RESPONSE_BYTES = 1_048_576
private val IDEMPOTENCY_PATTERN = Regex("[A-Za-z0-9_-]{8,128}")
private val SAFE_ORDER_ID_PATTERN = Regex("[A-Za-z0-9_-]{1,128}")
private val SAFE_DISPUTE_ID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")

private fun requireSafeOrderId(value: String) {
    require(SAFE_ORDER_ID_PATTERN.matches(value)) { "That order could not be found." }
}

private fun requireSafeDisputeId(value: String) {
    require(isCanonicalUuid(value)) { "That dispute could not be found." }
}

private fun isCanonicalUuid(value: String): Boolean = SAFE_DISPUTE_ID_PATTERN.matches(value) &&
    runCatching { UUID.fromString(value) }.isSuccess

private fun requireSafeIdempotencyKey(value: String) {
    require(IDEMPOTENCY_PATTERN.matches(value)) { "Could not safely prepare this action. Please try again." }
}

private fun validateHttpsUrls(values: List<String>, label: String) {
    require(values.size <= 10) { "$label may include at most 10 links." }
    values.forEach { raw ->
        require(raw.toByteArray(Charsets.UTF_8).size <= 500 && raw == raw.trim()) { "$label links must be valid HTTPS URLs." }
        val uri = runCatching { URI(raw) }.getOrNull()
        require(uri?.scheme.equals("https", ignoreCase = true) && !uri?.host.isNullOrBlank() && uri?.userInfo == null) {
            "$label links must be valid HTTPS URLs."
        }
    }
}

private fun unwrapDisputeObject(payload: JSONObject): JSONObject {
    if (!payload.has("data")) return payload
    val data = payload.opt("data")
    require(data is JSONObject) { "Nantty returned an incomplete dispute response." }
    return data
}

private fun JSONObject.requiredString(key: String): String {
    val raw = opt(key)
    require(raw is String && raw.isNotBlank()) { "Nantty returned an incomplete dispute response." }
    return raw
}

private fun JSONObject.nullableString(key: String): String? {
    require(has(key)) { "Nantty returned an incomplete dispute response." }
    val raw = opt(key)
    if (raw == null || raw == JSONObject.NULL) return null
    return raw as? String ?: error("Nantty returned an invalid dispute response.")
}

private fun JSONObject.requiredSafeId(key: String): String = requiredString(key).also {
    require(SAFE_ORDER_ID_PATTERN.matches(it)) { "Nantty returned an invalid dispute identifier." }
}

private fun JSONObject.requiredSafeNestedId(parent: String, key: String): String =
    (optJSONObject(parent) ?: error("Nantty returned an incomplete dispute response.")).requiredSafeId(key)

private fun JSONObject.requiredMoney(key: String): DisputeMoney {
    val money = optJSONObject(key) ?: error("Nantty returned incomplete payment details.")
    val amountValue = money.opt("amountMinor") as? Number ?: error("Nantty returned invalid payment details.")
    val amountMinor = runCatching { BigDecimal(amountValue.toString()).longValueExact() }.getOrNull()
        ?: error("Nantty returned invalid payment details.")
    require(amountMinor >= 0) { "Nantty returned invalid payment details." }
    val currency = money.requiredString("currency")
    require(currency.matches(Regex("[A-Z]{3}"))) { "Nantty returned invalid payment currency." }
    return DisputeMoney(amountMinor, currency)
}

private fun JSONObject.requiredObjectArray(key: String): List<JSONObject> {
    val values = optJSONArray(key) ?: error("Nantty returned an incomplete dispute response.")
    return buildList {
        for (index in 0 until values.length()) add(values.optJSONObject(index) ?: error("Nantty returned an invalid dispute response."))
    }
}

private fun JSONObject.requiredHttpsUrlArray(key: String): List<String> {
    val values = optJSONArray(key) ?: error("Nantty returned an incomplete dispute response.")
    require(values.length() <= 10) { "Nantty returned too many dispute attachments." }
    return buildList {
        for (index in 0 until values.length()) {
            val url = values.optString(index).takeIf(String::isNotBlank)
                ?: error("Nantty returned an invalid dispute attachment.")
            validateHttpsUrls(listOf(url), "Attachments")
            add(url)
        }
    }
}

private fun JSONObject.nullableHttpsUrl(key: String): String? {
    val url = nullableString(key) ?: return null
    validateHttpsUrls(listOf(url), "Avatar")
    return url
}

private fun safeOptionalHttpsUrl(raw: String): String? =
    runCatching { validateHttpsUrls(listOf(raw), "Tracking"); raw }.getOrNull()
