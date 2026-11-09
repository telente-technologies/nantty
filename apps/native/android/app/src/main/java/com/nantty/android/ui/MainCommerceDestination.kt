package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.WalletRepository
import java.util.concurrent.Executor

/** Keeps the cart/order/wallet destination branches together and out of the app-wide dispatcher. */
@Composable
internal fun MainCommerceDestination(
    destination: Destination,
    walletRepository: WalletRepository?,
    buyerOrdersRepository: BuyerOrdersRepository?,
    buyerReturnsRepository: BuyerReturnsRepository?,
    productReviewsRepository: ProductReviewsRepository?,
    disputeRepository: DisputeRepository?,
    privateMediaUploadsRepository: CreatorSampleMediaRepository?,
    messagesRepository: MessagesRepository?,
    supportTicketRepository: SupportTicketRepository?,
    executor: Executor?,
    onReauthenticate: () -> Unit,
    onBackFromOrders: () -> Unit,
    onCheckBuyerOrderPayment: (BuyerOrderDetail) -> Unit,
    onOpenStore: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenConversation: (com.nantty.android.data.InboxConversation) -> Unit,
    onMessageFailure: (String, Boolean) -> Unit,
    initialOrderId: String?,
    onInitialOrderHandled: () -> Unit,
    initialDisputeId: String?,
    onInitialDisputeHandled: () -> Unit,
    modifier: Modifier,
): Boolean {
    val backgroundExecutor = executor
    if (destination == Destination.DisputeDetail && disputeRepository != null && backgroundExecutor != null && initialDisputeId != null) {
        BuyerDisputeDetailScreen(
            disputeId = initialDisputeId,
            repository = disputeRepository,
            executor = backgroundExecutor,
            onBack = onBackFromOrders,
            onReauthenticate = onReauthenticate,
            modifier = modifier,
        )
        androidx.compose.runtime.LaunchedEffect(initialDisputeId) { onInitialDisputeHandled() }
        return true
    }
    if (destination == Destination.Wallet && walletRepository != null && backgroundExecutor != null) {
        WalletScreen(walletRepository, backgroundExecutor, modifier)
        return true
    }
    if (destination == Destination.Orders && buyerOrdersRepository != null && backgroundExecutor != null) {
        BuyerOrdersScreen(
            repository = buyerOrdersRepository,
            returnRepository = buyerReturnsRepository,
            executor = backgroundExecutor,
            onBack = onBackFromOrders,
            onAuthenticationRequired = onReauthenticate,
            disputeRepository = disputeRepository,
            privateMediaUploadsRepository = privateMediaUploadsRepository,
            onOpenStore = onOpenStore,
            onOpenProduct = onOpenProduct,
            onCheckPayment = onCheckBuyerOrderPayment,
            reviewRepository = productReviewsRepository,
            messagesRepository = messagesRepository,
            supportTicketRepository = supportTicketRepository,
            onOpenConversation = onOpenConversation,
            onMessageFailure = onMessageFailure,
            initialOrderId = initialOrderId,
            onInitialOrderHandled = onInitialOrderHandled,
            modifier = modifier,
        )
        return true
    }
    return false
}
