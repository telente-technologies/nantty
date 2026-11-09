package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.nantty.android.data.BuyerOrderCancellationResult
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrderReceiptResult
import com.nantty.android.data.buyerCanCancelOrder
import com.nantty.android.data.buyerCanConfirmReceipt
import androidx.compose.ui.unit.dp

@Composable
internal fun BuyerOrderActionDialogs(
    order: BuyerOrderDetail?,
    showReceiptDialog: Boolean,
    showCancellationDialog: Boolean,
    receiptConfirmed: Boolean,
    confirmingReceipt: Boolean,
    cancellingOrder: Boolean,
    receiptError: BuyerOrderReceiptResult.Failure?,
    cancellationError: BuyerOrderCancellationResult.Failure?,
    onConfirmReceipt: () -> Unit,
    onCancelOrder: () -> Unit,
    onDismissReceipt: () -> Unit,
    onDismissCancellation: () -> Unit,
    onAuthenticationRequired: () -> Unit,
) {
    val current = order ?: return
    if (showReceiptDialog && buyerCanConfirmReceipt(current.status) && !receiptConfirmed) {
        AlertDialog(
            onDismissRequest = onDismissReceipt,
            title = { Text("Confirm you received it?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(buyerReceiptConfirmationMessage(current.paymentMode, current.storeName))
                    receiptError?.let { Text(it.message, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !confirmingReceipt && receiptError?.authenticationRequired != true,
                    onClick = onConfirmReceipt,
                ) { Text(if (confirmingReceipt) "Confirming…" else "Yes, release payment") }
            },
            dismissButton = {
                TextButton(
                    enabled = !confirmingReceipt,
                    onClick = {
                        if (receiptError?.authenticationRequired == true) onAuthenticationRequired()
                        onDismissReceipt()
                    },
                ) { Text(if (receiptError?.authenticationRequired == true) "Sign in again" else "Cancel") }
            },
        )
    }
    if (showCancellationDialog && buyerCanCancelOrder(current.status)) {
        AlertDialog(
            onDismissRequest = onDismissCancellation,
            title = { Text("Cancel this order?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Cancellation depends on the order’s current status. If payment has been made, the seller may need to process a refund.")
                    cancellationError?.let { Text(it.message, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !cancellingOrder && cancellationError?.authenticationRequired != true,
                    onClick = onCancelOrder,
                ) { Text(if (cancellingOrder) "Cancelling…" else "Yes, cancel order") }
            },
            dismissButton = {
                TextButton(
                    enabled = !cancellingOrder,
                    onClick = {
                        if (cancellationError?.authenticationRequired == true) onAuthenticationRequired()
                        onDismissCancellation()
                    },
                ) { Text(if (cancellationError?.authenticationRequired == true) "Sign in again" else "Keep order") }
            },
        )
    }
}

internal fun buyerReceiptConfirmationMessage(paymentMode: String, storeName: String): String =
    if (paymentMode == "direct") {
        "Only confirm if everything arrived as described."
    } else {
        "Only confirm if everything arrived as described. $storeName will be paid right away and this can't be undone."
    }
