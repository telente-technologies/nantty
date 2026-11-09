package com.nantty.android.data

internal enum class SellerReturnStatus(val apiValue: String?, val label: String) {
    ALL(null, "All"),
    REQUESTED("requested", "Requested"),
    APPROVED("approved", "Approved"),
    DECLINED("declined", "Declined"),
    REFUNDED("refunded", "Refunded"),
}

internal data class SellerReturnMoney(val amountMinor: Long, val currency: String)

internal data class SellerReturnLine(
    val orderLineId: String,
    val name: String,
    val quantity: Int,
)

internal data class SellerReturnRequest(
    val id: String,
    val orderId: String,
    val orderNumber: String,
    val buyerName: String,
    val lines: List<SellerReturnLine>,
    val reason: String,
    val status: String,
    val declineNote: String?,
    val refundAmount: SellerReturnMoney,
    val createdAt: String,
)

internal data class SellerReturnsPage(
    val returns: List<SellerReturnRequest>,
    val nextCursor: String?,
)

internal data class SellerReturnLocation(
    val id: String,
    val name: String,
    val city: String,
    val state: String,
    val active: Boolean,
    val isDefault: Boolean,
)

internal sealed interface SellerReturnsResult<out T> {
    data class Success<T>(val value: T) : SellerReturnsResult<T>
    data class Failure(
        val message: String,
        val authenticationRequired: Boolean = false,
        val permissionDenied: Boolean = false,
        val conflict: Boolean = false,
    ) : SellerReturnsResult<Nothing>
}

internal fun sellerReturnActions(status: String): Set<String> = when (status) {
    "requested" -> setOf("approve", "decline")
    "approved" -> setOf("receive")
    else -> emptySet()
}
