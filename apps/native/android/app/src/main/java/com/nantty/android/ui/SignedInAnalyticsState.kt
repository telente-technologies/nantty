package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BrandProfilesResult
import java.util.concurrent.Executor

@Composable
internal fun rememberSignedInActiveProfileId(
    accountId: String?,
    isGuest: Boolean,
    repository: BrandProfilesRepository,
    executor: Executor,
): String? {
    var activeProfileId by remember(accountId) { mutableStateOf<String?>(null) }
    LaunchedEffect(accountId, isGuest, repository) {
        if (isGuest || accountId.isNullOrBlank()) {
            activeProfileId = null
        } else {
            executor.execute {
                val loadedProfileId = (repository.load() as? BrandProfilesResult.Success)
                    ?.state?.activeProfile?.id
                Snapshot.withMutableSnapshot { activeProfileId = loadedProfileId }
            }
        }
    }
    return activeProfileId
}
