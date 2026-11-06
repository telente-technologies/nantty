package com.nantty.android.ui.spaces

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.SpaceInvitePerson
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.SpacesResult
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.delay

@Composable
internal fun SpaceInviteSearchEffect(
    showInvite: Boolean,
    query: String,
    accessToken: String?,
    retry: Int,
    repository: SpacesRepository,
    executor: Executor,
    onReset: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onSearchStarted: () -> Unit,
    onSearchCompleted: (SpacesResult<List<SpaceInvitePerson>>) -> Unit,
) {
    val requestGeneration = androidx.compose.runtime.remember { AtomicInteger(0) }
    LaunchedEffect(showInvite, query, accessToken, retry) {
        val generation = requestGeneration.incrementAndGet()
        val normalizedQuery = query.trim()
        onReset()
        if (!showInvite || normalizedQuery.length < 2) return@LaunchedEffect

        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onAuthenticationRequired()
            return@LaunchedEffect
        }

        delay(300)
        onSearchStarted()
        executor.execute {
            val result = repository.searchInvitePeople(normalizedQuery, token)
            if (requestGeneration.get() != generation) return@execute
            Snapshot.withMutableSnapshot { onSearchCompleted(result) }
        }
    }
}
