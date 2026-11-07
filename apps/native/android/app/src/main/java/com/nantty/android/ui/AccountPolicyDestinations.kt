package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.AccountHealthRepository
import com.nantty.android.data.IdentityVerificationRepository
import com.nantty.android.ui.verification.IdentityVerificationScreen
import java.util.concurrent.Executor

/** Renders the account standing and identity routes without growing the main destination dispatcher. */
@Composable
internal fun AccountPolicyDestination(
    destination: Destination,
    accountHealthRepository: AccountHealthRepository?,
    identityVerificationRepository: IdentityVerificationRepository?,
    executor: Executor?,
    modifier: Modifier,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
): Boolean = when (destination) {
    Destination.AccountStatus -> {
        val repository = accountHealthRepository
        val ioExecutor = executor
        if (repository == null || ioExecutor == null) false
        else {
            AccountStatusScreen(repository, ioExecutor, onBack, onReauthenticate)
            true
        }
    }
    Destination.IdentityVerification -> {
        val repository = identityVerificationRepository
        if (repository == null) false
        else {
            IdentityVerificationScreen(repository, onBack, onReauthenticate, modifier)
            true
        }
    }
    else -> false
}
