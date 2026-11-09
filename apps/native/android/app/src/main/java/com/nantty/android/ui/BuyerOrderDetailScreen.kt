package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrderDetailResult
import com.nantty.android.data.BuyerOrderReceiptResult
import com.nantty.android.data.BuyerOrderCancellationResult
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.buyerCanCancelOrder
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.SupportLinkedReference
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.buyerCanOpenDispute
import com.nantty.android.data.buyerCanConfirmReceipt
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor
import java.util.UUID

@Composable
internal fun BuyerOrderDetailScreen(
    orderId: String,
    repository: BuyerOrdersRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
    disputeRepository: DisputeRepository? = null,
    privateMediaUploadsRepository: CreatorSampleMediaRepository? = null,
    onOpenStore: (String) -> Unit = {},
    onOpenProduct: (String) -> Unit = {},
    onCheckPayment: (BuyerOrderDetail) -> Unit = {},
    reviewRepository: ProductReviewsRepository? = null,
    messagesRepository: MessagesRepository? = null,
    onOpenConversation: (InboxConversation) -> Unit = {},
    onMessageFailure: (String, Boolean) -> Unit = { _, _ -> },
    onOpenSupport: (SupportLinkedReference) -> Unit = {},
    supportAvailable: Boolean = false,
    returnRepository: BuyerReturnsRepository? = null,
) {
    val effectiveReturnRepository = remember(repository, returnRepository) {
        returnRepository ?: repository.buyerReturnsRepository()
    }
    var result by remember(orderId) { mutableStateOf<BuyerOrderDetailResult?>(null) }
    var retry by remember(orderId) { mutableIntStateOf(0) }
    var generation by remember(orderId) { mutableIntStateOf(0) }
    var showConfirmDialog by remember(orderId) { mutableStateOf(false) }
    var showCancelDialog by remember(orderId) { mutableStateOf(false) }
    var confirmingReceipt by remember(orderId) { mutableStateOf(false) }
    var cancellingOrder by remember(orderId) { mutableStateOf(false) }
    var receiptIdempotencyKey by remember(orderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var receiptConfirmed by remember(orderId) { mutableStateOf(false) }
    var receiptError by remember(orderId) { mutableStateOf<BuyerOrderReceiptResult.Failure?>(null) }
    var cancellationError by remember(orderId) { mutableStateOf<BuyerOrderCancellationResult.Failure?>(null) }
    var refreshError by remember(orderId) { mutableStateOf<String?>(null) }
    var contactingSeller by remember(orderId) { mutableStateOf(false) }
    var contactSellerFailure by remember(orderId) { mutableStateOf<String?>(null) }
    var escrowResult by remember(orderId) { mutableStateOf<DisputeRepositoryResult<OrderEscrowDetail>?>(null) }
    var showOpenDispute by rememberSaveable(orderId) { mutableStateOf(false) }
    var activeDisputeId by rememberSaveable(orderId) { mutableStateOf<String?>(null) }

    if (activeDisputeId != null && disputeRepository != null) {
        BuyerDisputeDetailScreen(
            disputeId = activeDisputeId!!,
            repository = disputeRepository,
            executor = executor,
            onBack = { activeDisputeId = null; retry += 1 },
            onReauthenticate = onAuthenticationRequired,
        )
        return
    }
    if (showOpenDispute && disputeRepository != null && privateMediaUploadsRepository != null) {
        BuyerOpenDisputeScreen(
            orderId = orderId,
            repository = disputeRepository,
            mediaRepository = privateMediaUploadsRepository,
            executor = executor,
            onBack = { showOpenDispute = false },
            onReauthenticate = onAuthenticationRequired,
            onCreated = { disputeId ->
                showOpenDispute = false
                activeDisputeId = disputeId
                retry += 1
            },
        )
        return
    }

    LaunchedEffect(orderId, retry, disputeRepository) {
        val request = ++generation
        result = null
        executor.execute {
            val loaded = repository.loadDetail(orderId)
            val escrow = disputeRepository?.loadEscrowForOrder(orderId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation == request) {
                    result = loaded
                    escrowResult = escrow
                }
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to orders" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Order details", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        when (val current = result) {
            null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
                Text("Loading order details", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.secondary)
            }
            is BuyerOrderDetailResult.Failure -> BuyerOrdersMessage(
                title = if (current.authenticationRequired) "Sign in to continue" else "Order unavailable",
                message = current.message,
                action = if (current.authenticationRequired) onAuthenticationRequired else ({ retry += 1 }),
                actionLabel = if (current.authenticationRequired) "Sign in again" else "Retry",
            )
            is BuyerOrderDetailResult.Success -> {
                BuyerOrderDetailContent(
                    order = current.order,
                    returnsRepository = effectiveReturnRepository,
                    orderExecutor = executor,
                    reviewRepository = reviewRepository,
                    reviewExecutor = executor,
                    onAuthenticationRequired = onAuthenticationRequired,
                    receiptConfirmed = receiptConfirmed,
                    confirmingReceipt = confirmingReceipt,
                    cancellingOrder = cancellingOrder,
                    refreshError = refreshError,
                    canOpenDispute = buyerCanOpenDispute(
                        current.order.status,
                        current.order.paymentMode == "direct",
                        (escrowResult as? DisputeRepositoryResult.Success)?.value,
                    ),
                    existingDisputeId = (escrowResult as? DisputeRepositoryResult.Success)?.value?.disputeId,
                    onConfirmReceipt = { showConfirmDialog = true },
                    onCancelOrder = { showCancelDialog = true },
                    onOpenDispute = { showOpenDispute = true },
                    onViewDispute = { disputeId -> activeDisputeId = disputeId },
                    onOpenStore = { onOpenStore(current.order.storeId) },
                    onOpenProduct = onOpenProduct,
                    onCheckPayment = { onCheckPayment(current.order) },
                    onOpenSupport = { onOpenSupport(SupportLinkedReference("order", current.order.id, "Order ${current.order.reference}")) },
                    supportAvailable = supportAvailable,
                    contactingSeller = contactingSeller,
                    contactSellerFailure = contactSellerFailure,
                    contactSellerAvailable = messagesRepository != null,
                    onContactSeller = {
                        val messages = messagesRepository ?: return@BuyerOrderDetailContent
                        if (contactingSeller) return@BuyerOrderDetailContent
                        contactingSeller = true
                        contactSellerFailure = null
                        startBuyerStoreConversation(
                            storeId = current.order.storeId,
                            repository = messages,
                            executor = executor,
                            onStarted = { conversation ->
                                contactingSeller = false
                                onOpenConversation(conversation)
                            },
                            onFailed = { message, authenticationRequired ->
                                contactingSeller = false
                                contactSellerFailure = message
                                onMessageFailure(message, authenticationRequired)
                            },
                        )
                    },
                    onRefreshAfterConfirmation = {
                        val request = ++generation
                        refreshError = null
                        executor.execute {
                            val loaded = repository.loadDetail(orderId)
                            val escrow = disputeRepository?.loadEscrowForOrder(orderId)
                            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                escrowResult = escrow
                                if (generation == request) {
                                    when (loaded) {
                                        is BuyerOrderDetailResult.Success -> result = loaded
                                        is BuyerOrderDetailResult.Failure -> refreshError = loaded.message
                                    }
                                }
                            }
                        }
                    },
                )
            }
        }
    }

    val displayedOrder = (result as? BuyerOrderDetailResult.Success)?.order
    BuyerOrderActionDialogs(
        order = displayedOrder,
        showReceiptDialog = showConfirmDialog,
        showCancellationDialog = showCancelDialog,
        receiptConfirmed = receiptConfirmed,
        confirmingReceipt = confirmingReceipt,
        cancellingOrder = cancellingOrder,
        receiptError = receiptError,
        cancellationError = cancellationError,
        onConfirmReceipt = {
            val currentOrder = displayedOrder ?: return@BuyerOrderActionDialogs
            if (confirmingReceipt || !buyerCanConfirmReceipt(currentOrder.status)) return@BuyerOrderActionDialogs
            confirmingReceipt = true
            receiptError = null
            executor.execute {
                when (val confirmed = repository.confirmReceipt(orderId, receiptIdempotencyKey)) {
                    is BuyerOrderReceiptResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        confirmingReceipt = false
                        receiptError = confirmed
                    }
                    is BuyerOrderReceiptResult.Success -> {
                        val refreshed = repository.loadDetail(orderId)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            confirmingReceipt = false
                            showConfirmDialog = false
                            receiptConfirmed = confirmed.order.status == "completed"
                            when (refreshed) {
                                is BuyerOrderDetailResult.Success -> { result = refreshed; refreshError = null }
                                is BuyerOrderDetailResult.Failure -> {
                                    result = BuyerOrderDetailResult.Success(confirmed.order)
                                    refreshError = refreshed.message
                                }
                            }
                        }
                    }
                }
            }
        },
        onCancelOrder = {
            val currentOrder = displayedOrder ?: return@BuyerOrderActionDialogs
            if (cancellingOrder || !buyerCanCancelOrder(currentOrder.status)) return@BuyerOrderActionDialogs
            cancellingOrder = true
            cancellationError = null
            executor.execute {
                when (val cancelled = repository.cancelOrder(orderId)) {
                    is BuyerOrderCancellationResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        cancellingOrder = false
                        cancellationError = cancelled
                    }
                    is BuyerOrderCancellationResult.Success -> {
                        val refreshed = repository.loadDetail(orderId)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            cancellingOrder = false
                            showCancelDialog = false
                            when (refreshed) {
                                is BuyerOrderDetailResult.Success -> { result = refreshed; refreshError = null }
                                is BuyerOrderDetailResult.Failure -> {
                                    result = BuyerOrderDetailResult.Success(cancelled.order)
                                    refreshError = refreshed.message
                                }
                            }
                        }
                    }
                }
            }
        },
        onDismissReceipt = { showConfirmDialog = false },
        onDismissCancellation = { showCancelDialog = false },
        onAuthenticationRequired = onAuthenticationRequired,
    )
}
