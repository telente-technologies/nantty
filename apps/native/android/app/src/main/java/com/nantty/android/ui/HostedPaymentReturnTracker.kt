package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.lifecycle.LifecycleOwner

internal class HostedPaymentReturnTracker(
    awaitingReturn: Boolean = false,
    appWasPaused: Boolean = false,
) {
    private var awaitingProviderReturn = awaitingReturn
    private var providerPausedApp = appWasPaused

    fun prepareForReturn() {
        awaitingProviderReturn = true
        providerPausedApp = false
    }

    fun onPause(): Boolean {
        if (awaitingProviderReturn) providerPausedApp = true
        return providerPausedApp
    }

    fun onResume(): Boolean {
        if (!awaitingProviderReturn || !providerPausedApp) return false
        cancel()
        return true
    }

    fun cancel() {
        awaitingProviderReturn = false
        providerPausedApp = false
    }
}

internal fun Context.findLifecycleOwner(): LifecycleOwner? {
    var current: Context? = this
    while (current != null) {
        if (current is LifecycleOwner) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
