package com.nantty.android.ui.auth

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@RunWith(AndroidJUnit4::class)
class RegistrationFlowScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun emailStepValidatesBeforeSendingAndNormalizesTheDestination() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Contact),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Send Code").assertIsNotEnabled()
        compose.onNode(hasSetTextAction()).performTextInput(" Person@Example.NG ")
        compose.onNodeWithText("Send Code").assertIsEnabled().performClick()

        compose.runOnIdle { assertEquals("person@example.ng", calls.sentEmail) }
    }

    @Test
    fun welcomeOffersExplicitGuestBrowsingWithoutStartingSignup() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Welcome),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Browse as guest").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(1, calls.guestBrowseCount) }
    }

    @Test
    fun otpInputFiltersNonDigitsAndVerifiesOnceWhenSixDigitsAreEntered() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.VerifyCode, destination = "person@example.ng"),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Your code was sent to person@example.ng").assertIsDisplayed()
        compose.onNode(hasSetTextAction()).performTextInput("12a3456")
        compose.runOnIdle { assertEquals("123456", calls.verifiedCode) }
    }

    @Test
    fun birthdayStepUsesSharedAgeAndCalendarValidationAndReturnsIsoDate() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Birthday),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Next").assertIsNotEnabled()
        compose.onNode(hasSetTextAction()).performTextInput("31022000")
        compose.onNodeWithText("Next").assertIsNotEnabled()
    }

    @Test
    fun birthdayStepRejectsAnAccountHolderUnderTheSharedMinimumAge() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Birthday),
                    callbacks = calls.callbacks(),
                )
            }
        }
        val underageDate = LocalDate.now(ZoneOffset.UTC).minusYears(12).format(DateTimeFormatter.ofPattern("ddMMuuuu"))

        compose.onNode(hasSetTextAction()).performTextInput(underageDate)
        compose.onNodeWithText("Next").assertIsNotEnabled()
        compose.onNodeWithText("at least 13 years old", substring = true).assertIsDisplayed()
    }

    @Test
    fun validBirthdayIsSentAsIsoDate() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Birthday),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNode(hasSetTextAction()).performTextInput("04052000")
        compose.onNodeWithText("Next").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("2000-05-04", calls.birthdayIso) }
    }

    @Test
    fun passwordMustMeetSharedPolicyAndVisibilityControlIsAccessible() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Password),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Next").assertIsNotEnabled()
        compose.onNodeWithText("Show").assertIsDisplayed().performClick()
        compose.onNode(hasSetTextAction()).performTextInput("nantty#42")
        compose.onNodeWithText("Next").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("nantty#42", calls.continuedPassword) }
    }

    @Test
    fun topicStepRequiresMinimumSelectionThenReportsSelectedIds() {
        val calls = RecordingCallbacks()
        val topics = listOf(
            RegistrationTopic("fashion", "Fashion"),
            RegistrationTopic("beauty", "Beauty"),
            RegistrationTopic("home", "Home"),
        )
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(step = RegistrationStep.Personalization, topics = topics),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNodeWithText("Continue").assertIsNotEnabled()
        compose.onNodeWithText("Fashion").performClick()
        compose.onNodeWithText("Beauty").performClick()
        compose.onNodeWithText("Home").performClick()
        compose.onNodeWithText("Continue").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals(setOf("fashion", "beauty", "home"), calls.savedTopicIds) }
    }

    @Test
    fun usernameAvailabilityIsReportedAndAccountCreationWaitsForAvailableState() {
        val calls = RecordingCallbacks()
        val flowState = mutableStateOf(
            RegistrationFlowState(
                step = RegistrationStep.Username,
                suggestedUsername = "nantty_user",
                usernameAvailability = UsernameAvailability.Idle,
            ),
        )
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(state = flowState.value, callbacks = calls.callbacks())
            }
        }

        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        compose.runOnIdle { assertEquals("nantty_user", calls.checkedUsername) }
        compose.onNodeWithText("Confirm").assertIsNotEnabled()
        compose.runOnIdle { flowState.value = flowState.value.copy(usernameAvailability = UsernameAvailability.Available) }
        compose.onNodeWithText("Confirm").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("nantty_user", calls.createdUsername) }
    }

    @Test
    fun selectingSuggestedUsernameChecksAvailabilityBeforeAccountCreation() {
        val calls = RecordingCallbacks()
        compose.setContent {
            MaterialTheme {
                RegistrationFlowScreen(
                    state = RegistrationFlowState(
                        step = RegistrationStep.Username,
                        suggestedUsername = "nantty_user",
                        usernameAvailability = UsernameAvailability.Idle,
                    ),
                    callbacks = calls.callbacks(),
                )
            }
        }

        compose.onNode(hasSetTextAction()).performTextClearance()
        compose.onNode(hasSetTextAction()).performTextInput("another_user")
        compose.onNodeWithText("Use suggestion").performClick()
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()

        compose.runOnIdle {
            assertEquals("nantty_user", calls.checkedUsername)
            assertEquals(null, calls.createdUsername)
        }
        compose.onNodeWithText("Confirm").assertIsNotEnabled()
    }

    private class RecordingCallbacks {
        var sentEmail: String? = null
        var verifiedCode: String? = null
        var birthdayIso: String? = null
        var continuedPassword: String? = null
        var savedTopicIds: Set<String>? = null
        var checkedUsername: String? = null
        var createdUsername: String? = null
        var guestBrowseCount = 0

        fun callbacks() = RegistrationFlowCallbacks(
            onStartSignup = {},
            onContinueWithApple = {},
            onContinueWithGoogle = {},
            onLogin = {},
            onWelcomeDismiss = {},
            onBrowseAsGuest = { guestBrowseCount++ },
            onBack = {},
            onSendCode = { sentEmail = it },
            onSaveLoginInfoChanged = {},
            onVerifyCode = { verifiedCode = it },
            onResendCode = {},
            onBirthdayContinue = { birthdayIso = it },
            onPasswordContinue = { continuedPassword = it },
            onCreateAccount = { createdUsername = it },
            onUsernameAvailability = { checkedUsername = it },
            onTopicsLoad = {},
            onSaveTopics = { savedTopicIds = it },
            onSkipTopics = {},
            onTopicSelectionChanged = {},
        )
    }
}
