package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SignInScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun signInRequiresCredentialsAndSubmitsEnteredValues() {
        var submittedIdentifier = ""
        var submittedPassword = ""
        compose.setContent {
            MaterialTheme {
                SignInScreen(loading = false, error = null, onSignIn = { identifier, password ->
                    submittedIdentifier = identifier
                    submittedPassword = password
                })
            }
        }

        compose.onNodeWithText("Sign in").assertIsNotEnabled()
        compose.onNodeWithText("Email or username").performTextInput("  ari@example.com  ")
        compose.onNodeWithText("Password").performTextInput("example-password")
        compose.onNodeWithText("Sign in").assertIsDisplayed().performClick()
        compose.runOnIdle {
            assertEquals("ari@example.com", submittedIdentifier)
            assertEquals("example-password", submittedPassword)
        }
    }

    @Test
    fun errorAndLoadingStatesAreVisibleAndDisableSubmission() {
        compose.setContent {
            MaterialTheme {
                SignInScreen(loading = true, error = "Could not connect to Nantty.", onSignIn = { _, _ -> })
            }
        }
        compose.onNodeWithText("Could not connect to Nantty.").assertIsDisplayed()
        compose.onNodeWithText("Signing in…").assertIsDisplayed().assertIsNotEnabled()
    }

    @Test
    fun signInOffersGuestBrowsing() {
        var browseRequested = false
        compose.setContent {
            MaterialTheme {
                SignInScreen(
                    loading = false,
                    error = null,
                    onSignIn = { _, _ -> },
                    onBrowseAsGuest = { browseRequested = true },
                )
            }
        }
        compose.onNodeWithText("Browse as guest").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(true, browseRequested) }
    }

    @Test
    fun configuredGoogleProviderIsAvailableOnDedicatedSignInScreen() {
        var googleRequested = false
        compose.setContent {
            MaterialTheme {
                SignInScreen(
                    loading = false,
                    error = null,
                    onSignIn = { _, _ -> },
                    onGoogleSignIn = { googleRequested = true },
                )
            }
        }
        compose.onNodeWithText("Continue with Google").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(true, googleRequested) }
    }

    @Test
    fun unconfiguredGoogleProviderIsNotShownOnDedicatedSignInScreen() {
        compose.setContent {
            MaterialTheme {
                SignInScreen(loading = false, error = null, onSignIn = { _, _ -> })
            }
        }
        compose.onNodeWithText("Continue with Google").assertDoesNotExist()
    }
}
