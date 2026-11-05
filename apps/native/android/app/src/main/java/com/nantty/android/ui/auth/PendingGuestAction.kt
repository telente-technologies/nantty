package com.nantty.android.ui.auth

/** A transient protected-action continuation; it is consumed once or discarded on auth cancellation. */
internal class PendingGuestAction {
    private var action: (() -> Unit)? = null

    fun remember(next: () -> Unit) {
        action = next
    }

    fun discard() {
        action = null
    }

    fun takeAfterSignIn(): (() -> Unit)? {
        val pending = action
        action = null
        return pending
    }
}
