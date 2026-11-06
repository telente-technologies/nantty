package com.nantty.android.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nantty.android.data.DeviceSavedCard
import com.nantty.android.data.SavedCardCredentialStore
import com.nantty.android.data.SavedCardRepository
import com.nantty.android.data.SavedCardResult
import java.util.UUID
import java.util.concurrent.Executor

/** Device enrollment runs before the order payment intent when the buyer opts in at checkout. */
@Composable
internal fun CheckoutSavedCardSetup(
    repository: SavedCardRepository,
    credentialStore: SavedCardCredentialStore,
    executor: Executor,
    enabled: Boolean,
    onAuthenticationRequired: () -> Unit,
    onSetupComplete: () -> Unit,
    onUseHostedCheckout: () -> Unit,
) {
    var setupReference by rememberSaveable { mutableStateOf<String?>(null) }
    var setupUrl by rememberSaveable { mutableStateOf<String?>(null) }
    var starting by rememberSaveable { mutableStateOf(false) }
    var completing by rememberSaveable { mutableStateOf(false) }
    var complete by rememberSaveable { mutableStateOf(false) }
    var awaitingReturn by rememberSaveable { mutableStateOf(false) }
    var leftForProvider by rememberSaveable { mutableStateOf(false) }
    var message by rememberSaveable { mutableStateOf<String?>(null) }
    var requestKey by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    fun startSetup() {
        if (starting || completing || complete || !enabled || setupReference != null || setupUrl != null) return
        starting = true
        message = null
        executor.execute {
            if (runCatching(credentialStore::readDisplay).getOrNull() != null) {
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    starting = false
                    complete = true
                    message = "A saved card is already available on this device."
                    onSetupComplete()
                }
                return@execute
            }
            when (val result = repository.startSetup(requestKey)) {
                is SavedCardResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    setupReference = result.value.reference
                    setupUrl = result.value.checkoutUrl
                    starting = false
                }
                is SavedCardResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    starting = false
                    message = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
        }
    }

    fun completeSetup() {
        val reference = setupReference ?: return
        if (completing || complete) return
        completing = true
        message = "Confirming your card with Nantty…"
        executor.execute {
            when (val result = repository.completeSetup(reference)) {
                is SavedCardResult.Success -> runCatching {
                    credentialStore.save(
                        DeviceSavedCard(
                            savedCardId = result.value.savedCardId,
                            brand = result.value.brand,
                            last4 = result.value.last4,
                            expiryMonth = result.value.expiryMonth,
                            expiryYear = result.value.expiryYear,
                        ),
                    )
                }.fold(
                    onSuccess = {
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            completing = false
                            complete = true
                            setupUrl = null
                            message = "Card verified and saved on this device."
                            onSetupComplete()
                        }
                    },
                    onFailure = {
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            completing = false
                            message = "Card verification completed, but it couldn't be saved on this device. You can try again."
                        }
                    },
                )
                is SavedCardResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    completing = false
                    message = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
        }
    }

    LaunchedEffect(enabled) {
        if (enabled) startSetup()
    }
    DisposableEffect(lifecycleOwner, setupReference, awaitingReturn, leftForProvider) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> if (awaitingReturn) leftForProvider = true
                Lifecycle.Event.ON_RESUME -> if (awaitingReturn && leftForProvider) {
                    awaitingReturn = false
                    leftForProvider = false
                    completeSetup()
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Text("Save card on this device", style = MaterialTheme.typography.titleMedium)
        Text(
            "Nantty verifies the card and stores its secure card token and masked details on this device. This setup does not pay for your order; the order stays unpaid until Nantty confirms a separate charge. Card numbers and provider authorization data are never stored.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (message != null) Text(message.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = if (complete) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
        if (starting || completing) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        } else if (!complete && setupUrl == null && enabled) {
            OutlinedButton(onClick = {
                requestKey = UUID.randomUUID().toString()
                setupReference = null
                message = null
                startSetup()
            }) { Text("Retry card setup") }
        } else if (!complete && setupUrl != null) {
            Button(
                onClick = {
                    awaitingReturn = true
                    leftForProvider = false
                    openSavedCardSetup(context, setupUrl.orEmpty()) { error ->
                        awaitingReturn = false
                        leftForProvider = false
                        message = error
                    }
                },
            ) { Text("Verify card securely") }
            Text("Return to Nantty after your bank or card provider confirms the setup.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (!complete && enabled) {
            OutlinedButton(onClick = onUseHostedCheckout, enabled = !starting && !completing) {
                Text("Continue without saving card")
            }
        }
    }
}

private fun openSavedCardSetup(context: Context, url: String, onFailure: (String) -> Unit) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        .onFailure { onFailure("No browser could open the secure card-verification page. Try again.") }
}
