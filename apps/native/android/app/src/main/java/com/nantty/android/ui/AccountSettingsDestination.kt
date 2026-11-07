package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ContentPreferencesRepository
import com.nantty.android.data.CountryPreferenceRepository
import java.util.concurrent.Executor

/** Owns settings destinations so the app-wide content dispatcher stays focused on routing. */
@Composable
internal fun AccountSettingsDestination(
    destination: Destination,
    countryPreferenceRepository: CountryPreferenceRepository?,
    countryPreferenceNavigation: CountryPreferenceNavigation?,
    contentPreferencesRepository: ContentPreferencesRepository?,
    chatNotificationSettingsRepository: ChatNotificationSettingsRepository?,
    chatPasscodeRepository: ChatPasscodeRepository?,
    executor: Executor?,
    onReauthenticate: () -> Unit,
    onNotificationReauthenticate: () -> Unit,
    onBackFromContentPreferences: () -> Unit,
    onContentPreferencesChanged: () -> Unit,
    onBackFromChatSettings: () -> Unit,
    onOpenBlockedAccounts: () -> Unit,
    onOpenPasscodeSettings: () -> Unit,
    onChatNotificationsSaved: () -> Unit,
    onBackFromChatPasscode: () -> Unit,
    onChatPasscodeUpdated: () -> Unit,
    modifier: Modifier = Modifier,
): Boolean {
    when (destination) {
        Destination.CountryPreference -> {
            val repository = countryPreferenceRepository ?: return false
            val navigation = countryPreferenceNavigation ?: return false
            val backgroundExecutor = executor ?: return false
            CountryPreferenceScreen(
                repository = repository,
                executor = backgroundExecutor,
                onBack = navigation.returnToPrevious,
                onReauthenticate = onReauthenticate,
                onSaved = navigation.returnToPrevious,
                modifier = modifier,
            )
        }

        Destination.ContentPreferences -> {
            val repository = contentPreferencesRepository ?: return false
            val backgroundExecutor = executor ?: return false
            ContentPreferencesScreen(
                repository = repository,
                executor = backgroundExecutor,
                onBack = onBackFromContentPreferences,
                onReauthenticate = onReauthenticate,
                onPreferencesChanged = onContentPreferencesChanged,
                modifier = modifier,
            )
        }

        Destination.ChatNotificationSettings -> {
            val repository = chatNotificationSettingsRepository ?: return false
            val backgroundExecutor = executor ?: return false
            ChatNotificationSettingsScreen(
                repository = repository,
                executor = backgroundExecutor,
                onBack = onBackFromChatSettings,
                onReauthenticate = onNotificationReauthenticate,
                onOpenBlockedAccounts = onOpenBlockedAccounts,
                onOpenPasscodeSettings = onOpenPasscodeSettings,
                onSettingsChanged = onChatNotificationsSaved,
                modifier = modifier,
            )
        }

        Destination.ChatPasscode -> {
            val repository = chatPasscodeRepository ?: return false
            ChatPasscodeSettingsScreen(
                repository = repository,
                onBack = onBackFromChatPasscode,
                onPasscodeUpdated = onChatPasscodeUpdated,
                modifier = modifier,
            )
        }

        else -> return false
    }
    return true
}
