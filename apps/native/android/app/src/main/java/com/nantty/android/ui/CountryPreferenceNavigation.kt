package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue

internal data class CountryPreferenceNavigation(
    val open: () -> Unit,
    val returnToPrevious: () -> Unit,
)

@Composable
internal fun rememberCountryPreferenceNavigation(
    currentDestination: Destination,
    onDestinationChange: (Destination) -> Unit,
): CountryPreferenceNavigation {
    var previousDestination by rememberSaveable { mutableStateOf(Destination.Profile) }
    val current by rememberUpdatedState(currentDestination)
    val select by rememberUpdatedState(onDestinationChange)
    return remember {
        CountryPreferenceNavigation(
            open = {
                previousDestination = current
                select(Destination.CountryPreference)
            },
            returnToPrevious = { select(previousDestination) },
        )
    }
}
