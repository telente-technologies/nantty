package com.nantty.android.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import java.util.concurrent.atomic.AtomicBoolean

/** Tracks the current default network while a foreground hosted-payment check is active. */
internal class PaymentConnectivityMonitor(context: Context) : AutoCloseable {
    private val connectivity = context.applicationContext.getSystemService(ConnectivityManager::class.java)
    private val online = AtomicBoolean(readCurrentState())
    private var callback: ConnectivityManager.NetworkCallback? = null

    @Synchronized
    fun start() {
        if (callback != null) return
        val registered = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                updateFromCurrentState()
            }

            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                if (connectivity?.activeNetwork == network) update(networkCapabilities.hasValidatedInternet())
            }

            override fun onLost(network: Network) {
                updateFromCurrentState()
            }

            override fun onUnavailable() {
                update(false)
            }
        }
        connectivity?.registerDefaultNetworkCallback(registered)
        callback = registered
        updateFromCurrentState()
    }

    fun isOnline(): Boolean = online.get()

    @Synchronized
    override fun close() {
        callback?.let { registered -> runCatching { connectivity?.unregisterNetworkCallback(registered) } }
        callback = null
    }

    private fun updateFromCurrentState() {
        val network = connectivity?.activeNetwork
        val capabilities = network?.let(connectivity::getNetworkCapabilities)
        update(capabilities?.hasValidatedInternet() == true)
    }

    private fun readCurrentState(): Boolean {
        val network = connectivity?.activeNetwork ?: return false
        return connectivity.getNetworkCapabilities(network)?.hasValidatedInternet() == true
    }

    private fun update(value: Boolean) {
        online.set(value)
    }

    private fun NetworkCapabilities.hasValidatedInternet(): Boolean =
        hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}
