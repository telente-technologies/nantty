package com.nantty.android.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.glance.appwidget.updateAll
import com.nantty.android.NanttyApplication
import com.nantty.android.data.OrdersWidgetLoadResult
import com.nantty.android.data.OrdersWidgetRepository
import com.nantty.android.data.OrdersWidgetSnapshot
import com.nantty.android.data.OrdersWidgetSnapshotStore
import com.nantty.android.data.OrdersWidgetState
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

class OrdersWidgetRefreshWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
    override fun doWork(): Result {
        val app = applicationContext as? NanttyApplication ?: return Result.failure()
        val store = OrdersWidgetSnapshotStore(applicationContext)
        val revision = store.revision()
        val sessionRepository = app.sessionRepository

        val session = try {
            sessionRepository.sessionOrNull() ?: sessionRepository.restore()
        } catch (error: Exception) {
            val invalidSession = error is com.nantty.android.data.AuthApiException &&
                (error.statusCode == 401 || error.statusCode == 403)
            if (invalidSession) {
                store.writeIfCurrent(revision, OrdersWidgetSnapshot(OrdersWidgetState.SIGNED_OUT))
                updateWidget()
                return Result.success()
            }
            store.markRefreshFailed(revision, System.currentTimeMillis())
            updateWidget()
            return Result.retry()
        }

        if (session == null) {
            store.writeIfCurrent(revision, OrdersWidgetSnapshot(OrdersWidgetState.SIGNED_OUT))
            updateWidget()
            return Result.success()
        }

        val result = OrdersWidgetRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSession = sessionRepository::refreshSession,
        ).load()
        return when (result) {
            is OrdersWidgetLoadResult.Ready -> {
                val payload = result.payload
                val state = if (payload.activeCount == 0) OrdersWidgetState.EMPTY else OrdersWidgetState.READY
                store.writeIfCurrent(
                    revision,
                    OrdersWidgetSnapshot(state, payload.activeCount, payload.statusLabels, System.currentTimeMillis()),
                )
                updateWidget()
                Result.success()
            }
            OrdersWidgetLoadResult.SignedOut -> {
                store.writeIfCurrent(revision, OrdersWidgetSnapshot(OrdersWidgetState.SIGNED_OUT))
                updateWidget()
                Result.success()
            }
            is OrdersWidgetLoadResult.Failed -> {
                store.markRefreshFailed(revision, System.currentTimeMillis())
                updateWidget()
                if (result.statusCode == null || result.statusCode >= 500) Result.retry() else Result.success()
            }
        }
    }

    private fun updateWidget() {
        runCatching { runBlocking { OrdersGlanceWidget().updateAll(applicationContext) } }
    }
}

internal object OrdersWidgetRefreshScheduler {
    private const val PERIODIC_WORK = "nantty-orders-widget-refresh-periodic"
    private const val IMMEDIATE_WORK = "nantty-orders-widget-refresh-immediate"

    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<OrdersWidgetRefreshWorker>(30, TimeUnit.MINUTES)
            .setConstraints(networkConstraints())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun refreshSoon(context: Context, replaceExisting: Boolean = false) {
        val request = OneTimeWorkRequestBuilder<OrdersWidgetRefreshWorker>()
            .setConstraints(networkConstraints())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_WORK,
            if (replaceExisting) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun markSignedOut(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_WORK)
        OrdersWidgetSnapshotStore(context).markSignedOut()
        runCatching { runBlocking { OrdersGlanceWidget().updateAll(context.applicationContext) } }
    }

    private fun networkConstraints() = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
}
