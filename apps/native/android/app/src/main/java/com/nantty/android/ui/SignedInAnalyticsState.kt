package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BrandActingProfile
import com.nantty.android.data.BrandProfilesResult
import java.util.concurrent.Executor

@Composable
internal fun rememberSignedInActiveProfile(
    accountId: String?,
    isGuest: Boolean,
    repository: BrandProfilesRepository,
    executor: Executor,
): BrandActingProfile? {
    var activeProfile by remember(accountId) { mutableStateOf<BrandActingProfile?>(null) }
    LaunchedEffect(accountId, isGuest, repository) {
        if (isGuest || accountId.isNullOrBlank()) {
            activeProfile = null
        } else {
            executor.execute {
                val loadedProfile = (repository.load() as? BrandProfilesResult.Success)?.state?.activeProfile
                Snapshot.withMutableSnapshot { activeProfile = loadedProfile }
            }
        }
    }
    return activeProfile
}
