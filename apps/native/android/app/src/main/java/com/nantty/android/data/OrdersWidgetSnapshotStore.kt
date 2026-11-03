package com.nantty.android.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal enum class OrdersWidgetState { SIGNED_OUT, EMPTY, READY, STALE, ERROR }

internal data class OrdersWidgetSnapshot(
    val state: OrdersWidgetState,
    val activeCount: Int = 0,
    val statusLabels: List<String> = emptyList(),
    val updatedAtMillis: Long? = null,
)

internal fun ordersWidgetSnapshotAfterFailure(previous: OrdersWidgetSnapshot?, nowMillis: Long): OrdersWidgetSnapshot {
    val previousAge = previous?.updatedAtMillis?.let { nowMillis - it }
    val canKeepMinimalSummary = previousAge != null && previousAge in 0..OrdersWidgetSnapshotStore.MAX_STALE_DETAIL_AGE_MS &&
        previous?.state in setOf(OrdersWidgetState.READY, OrdersWidgetState.EMPTY, OrdersWidgetState.STALE)
    return if (canKeepMinimalSummary) previous!!.copy(state = OrdersWidgetState.STALE) else OrdersWidgetSnapshot(OrdersWidgetState.ERROR)
}

internal class OrdersWidgetSnapshotStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun revision(): Long = preferences.getLong(REVISION_KEY, 0L)

    @Synchronized
    fun read(): OrdersWidgetSnapshot? = preferences.getString(SNAPSHOT_KEY, null)?.let { encoded ->
        runCatching { JSONObject(encoded).toSnapshot() }.getOrNull()
    }

    @Synchronized
    fun writeIfCurrent(expectedRevision: Long, snapshot: OrdersWidgetSnapshot): Boolean {
        if (revision() != expectedRevision) return false
        return preferences.edit().putString(SNAPSHOT_KEY, snapshot.toJson().toString()).commit()
    }

    @Synchronized
    fun markSignedOut() {
        val nextRevision = revision() + 1
        check(
            preferences.edit()
                .putLong(REVISION_KEY, nextRevision)
                .putString(SNAPSHOT_KEY, OrdersWidgetSnapshot(OrdersWidgetState.SIGNED_OUT).toJson().toString())
                .commit(),
        ) { "Could not clear the orders widget snapshot." }
    }

    @Synchronized
    fun markRefreshFailed(expectedRevision: Long, nowMillis: Long): Boolean {
        if (revision() != expectedRevision) return false
        return writeIfCurrent(expectedRevision, ordersWidgetSnapshotAfterFailure(read(), nowMillis))
    }

    companion object {
        const val MAX_STALE_DETAIL_AGE_MS = 6 * 60 * 60 * 1000L
        private const val PREFERENCES_NAME = "nantty_orders_widget_snapshot_v1"
        private const val REVISION_KEY = "revision"
        private const val SNAPSHOT_KEY = "snapshot"
    }
}

private fun OrdersWidgetSnapshot.toJson() = JSONObject().apply {
    put("state", state.name)
    put("activeCount", activeCount.coerceAtLeast(0))
    put("statusLabels", JSONArray(statusLabels.take(OrdersWidgetRepository.MAX_WIDGET_ITEMS)))
    updatedAtMillis?.let { put("updatedAtMillis", it) }
}

private fun JSONObject.toSnapshot(): OrdersWidgetSnapshot {
    val state = runCatching { OrdersWidgetState.valueOf(optString("state")) }.getOrDefault(OrdersWidgetState.ERROR)
    val labels = optJSONArray("statusLabels")?.let { items ->
        buildList {
            for (index in 0 until minOf(items.length(), OrdersWidgetRepository.MAX_WIDGET_ITEMS)) {
                val value = items.optString(index).filterNot(Char::isISOControl).trim().take(48)
                if (value.isNotBlank()) add(value)
            }
        }
    }.orEmpty()
    return OrdersWidgetSnapshot(
        state = state,
        activeCount = optInt("activeCount").coerceAtLeast(0),
        statusLabels = labels,
        updatedAtMillis = optLong("updatedAtMillis").takeIf { it > 0 },
    )
}
