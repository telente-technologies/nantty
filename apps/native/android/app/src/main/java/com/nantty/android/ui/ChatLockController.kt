package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.nantty.android.data.ChatLockBackgroundPolicy
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ChatPasscodeResult
import com.nantty.android.data.ChatPasscodeSnapshot
import java.util.concurrent.Executor

/** Session-independent, device-local chat lock state shared across protected destinations. */
internal class ChatLockController(
    private val accountId: String?,
    private val isGuest: Boolean,
    private val repository: ChatPasscodeRepository,
    private val executor: Executor,
) {
    var snapshot by mutableStateOf<ChatPasscodeSnapshot?>(null)
        private set
    var isLoaded by mutableStateOf(isGuest || accountId == null)
        private set
    var isLocked by mutableStateOf(false)
        private set
    private var backgroundedAtMillis: Long? = null

    fun load() {
        if (isGuest || accountId == null) {
            snapshot = null
            isLoaded = true
            isLocked = false
            return
        }
        isLoaded = false
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is ChatPasscodeResult.Success -> {
                        snapshot = result.value
                        isLocked = result.value.isPasscodeSet
                    }
                    is ChatPasscodeResult.Failure -> {
                        // Fail closed if an existing device lock cannot be read.
                        snapshot = null
                        isLocked = true
                    }
                }
                isLoaded = true
            }
        }
    }

    fun unlock() { isLocked = false }

    fun refreshAfterPasscodeChange() {
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                if (result is ChatPasscodeResult.Success) {
                    snapshot = result.value
                    isLocked = false
                    isLoaded = true
                }
            }
        }
    }

    fun removePasscodeThen(onRemoved: () -> Unit) {
        executor.execute {
            repository.removePasscode()
            onRemoved()
        }
    }

    fun onLifecycleEvent(event: Lifecycle.Event) {
        when (event) {
            Lifecycle.Event.ON_PAUSE -> if (snapshot?.isPasscodeSet == true) {
                backgroundedAtMillis = backgroundedAtMillis ?: SystemClock.elapsedRealtime()
            }
            Lifecycle.Event.ON_RESUME -> {
                val backgrounded = backgroundedAtMillis
                val preferences = snapshot?.preferences
                if (backgrounded != null && preferences != null && ChatLockBackgroundPolicy.shouldLock(
                        isPasscodeSet = snapshot?.isPasscodeSet == true,
                        backgroundedAtMillis = backgrounded,
                        resumedAtMillis = SystemClock.elapsedRealtime(),
                        autoLockSeconds = preferences.autoLockSeconds,
                    )
                ) isLocked = true
                backgroundedAtMillis = null
            }
            else -> Unit
        }
    }
}

@Composable
internal fun rememberChatLockController(
    accountId: String?,
    isGuest: Boolean,
    repository: ChatPasscodeRepository,
    executor: Executor,
): ChatLockController {
    val context = LocalContext.current
    val controller = remember(accountId, isGuest, repository, executor) {
        ChatLockController(accountId, isGuest, repository, executor)
    }
    val lifecycleOwner = remember(context) { context.findChatLifecycleOwner() }
    LaunchedEffect(controller) { controller.load() }
    DisposableEffect(controller, lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event -> controller.onLifecycleEvent(event) }
        lifecycleOwner?.lifecycle?.addObserver(observer)
        onDispose { lifecycleOwner?.lifecycle?.removeObserver(observer) }
    }
    return controller
}

@Composable
internal fun ChatLockBoundary(
    accountId: String?,
    isGuest: Boolean,
    destination: Destination,
    repository: ChatPasscodeRepository,
    executor: Executor,
    onSignOut: () -> Unit,
    content: @Composable (onPasscodeUpdated: () -> Unit) -> Unit,
) {
    val controller = rememberChatLockController(accountId, isGuest, repository, executor)
    val context = LocalContext.current
    val mainExecutor = remember(context) { ContextCompat.getMainExecutor(context) }
    ChatLockGate(
        enabled = !isGuest && destination in CHAT_LOCKED_DESTINATIONS,
        isLoaded = controller.isLoaded,
        isLocked = controller.isLocked,
        snapshot = controller.snapshot,
        repository = repository,
        executor = executor,
        onUnlocked = controller::unlock,
        onForgotPasscode = { controller.removePasscodeThen { mainExecutor.execute(onSignOut) } },
    ) {
        content(controller::refreshAfterPasscodeChange)
    }
}

private val CHAT_LOCKED_DESTINATIONS = setOf(Destination.Messages, Destination.ChatNotificationSettings, Destination.ChatPasscode)

private fun Context.findChatLifecycleOwner(): LifecycleOwner? {
    var current: Context? = this
    while (current != null) {
        if (current is LifecycleOwner) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
