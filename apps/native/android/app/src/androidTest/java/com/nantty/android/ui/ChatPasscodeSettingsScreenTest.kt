package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.ChatLockPreferences
import com.nantty.android.data.ChatPasscodeKeyProvider
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ChatPasscodeStorage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

@RunWith(AndroidJUnit4::class)
class ChatPasscodeSettingsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun createsPasscodeAndExposesSupportedAutoLockOptions() {
        val repository = repository()
        show(repository, biometricAvailable = false)

        compose.onNodeWithText("Set a passcode").performClick()
        compose.onNodeWithContentDescription("New passcode (4 to 6 digits)").performTextInput("12a34567")
        compose.onNodeWithContentDescription("Confirm passcode").performTextInput("123456")
        compose.onNodeWithText("Save passcode").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Change passcode").assertIsDisplayed()
        compose.onNodeWithText("Auto-lock").assertIsDisplayed()
        listOf("Immediately", "After 1 min", "After 5 min", "After 15 min", "After 1 hour").forEach { label ->
            compose.onNodeWithContentDescription("Auto-lock: $label").assertIsDisplayed()
        }
        compose.onNodeWithContentDescription("Auto-lock: Immediately").performClick()
        compose.onNodeWithContentDescription("Auto-lock: Immediately").assertIsSelected()
        assertEquals(ChatLockPreferences(autoLockSeconds = 0), (repository.load() as com.nantty.android.data.ChatPasscodeResult.Success).value.preferences)
    }

    @Test
    fun changeRequiresCurrentPasscodeAndConfirmationThenRemoveClearsIt() {
        val repository = repository()
        assertTrue(repository.setPasscode("1357") is com.nantty.android.data.ChatPasscodeResult.Success)
        show(repository)

        compose.onNodeWithText("Change passcode").performClick()
        compose.onNodeWithContentDescription("Current passcode").performTextInput("9999")
        compose.onNodeWithContentDescription("New passcode (4 to 6 digits)").performTextInput("2468")
        compose.onNodeWithContentDescription("Confirm passcode").performTextInput("2468")
        compose.onNodeWithText("Save passcode").performClick()
        compose.onNodeWithText("Your current passcode is wrong.").assertIsDisplayed()
        assertEquals(com.nantty.android.data.ChatPasscodeResult.Success(false), repository.verifyPasscode("2468"))

        compose.onNodeWithContentDescription("Current passcode").performTextClearance()
        compose.onNodeWithContentDescription("Current passcode").performTextInput("1357")
        compose.onNodeWithText("Save passcode").performClick()
        compose.waitForIdle()
        assertEquals(com.nantty.android.data.ChatPasscodeResult.Success(true), repository.verifyPasscode("2468"))

        compose.onNodeWithText("Remove passcode").performClick()
        compose.onNodeWithContentDescription("Current passcode").performTextInput("2468")
        compose.onNodeWithText("Remove passcode").performClick()
        compose.waitForIdle()
        val snapshot = (repository.load() as com.nantty.android.data.ChatPasscodeResult.Success).value
        assertFalse(snapshot.isPasscodeSet)
        compose.onNodeWithText("Set a passcode").assertIsDisplayed()
    }

    @Test
    fun biometricsRemainDisabledWhenTheDeviceCannotAuthenticate() {
        val repository = repository()
        show(repository, biometricAvailable = false)

        compose.onNodeWithText("Unlock with biometrics").assertIsDisplayed()
        compose.onNodeWithText("Biometric unlock isn't available on this device.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Unlock with biometrics").assertIsOff().assertIsNotEnabled()
        assertFalse((repository.load() as com.nantty.android.data.ChatPasscodeResult.Success).value.preferences.biometricsEnabled)
    }

    @Test
    fun biometricsRequireConfiguredPasscode() {
        val repository = repository()
        show(repository, biometricAvailable = true)

        compose.onNodeWithText("Set a chat passcode before enabling biometric unlock.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Unlock with biometrics").assertIsOff().assertIsNotEnabled()
        assertFalse((repository.load() as com.nantty.android.data.ChatPasscodeResult.Success).value.preferences.biometricsEnabled)
    }

    @Test
    fun biometricsPreferencePersistsWhenAvailableAndPasscodeIsConfigured() {
        val repository = repository()
        assertTrue(repository.setPasscode("7531") is com.nantty.android.data.ChatPasscodeResult.Success)
        show(repository, biometricAvailable = true)
        compose.onNodeWithContentDescription("Unlock with biometrics").assertIsOff().assertIsEnabled()
        compose.onNodeWithContentDescription("Unlock with biometrics").performClick()
        compose.onNodeWithContentDescription("Unlock with biometrics").assertIsOn()
        assertTrue((repository.load() as com.nantty.android.data.ChatPasscodeResult.Success).value.preferences.biometricsEnabled)
    }

    private fun show(repository: ChatPasscodeRepository, biometricAvailable: Boolean? = null) {
        compose.setContent {
            MaterialTheme {
                ChatPasscodeSettingsScreen(
                    repository = repository,
                    executor = Executor { it.run() },
                    onBack = {},
                    biometricAvailabilityOverride = biometricAvailable,
                )
            }
        }
        compose.waitForIdle()
    }

    private fun repository(): ChatPasscodeRepository = ChatPasscodeRepository.forTests(MemoryStorage(), MemoryKeyProvider())

    private class MemoryStorage : ChatPasscodeStorage {
        private var stored: String? = null
        override fun read(): String? = stored
        override fun write(value: String): Boolean { stored = value; return true }
        override fun clear() { stored = null }
    }

    private class MemoryKeyProvider : ChatPasscodeKeyProvider {
        private var key: SecretKey? = SecretKeySpec(ByteArray(32) { it.toByte() }, "AES")
        override fun getOrCreateKey(): SecretKey = key ?: SecretKeySpec(ByteArray(32) { it.toByte() }, "AES").also { key = it }
        override fun deleteKey() { key = null }
    }
}
