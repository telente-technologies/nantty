package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CreatorApplicationRepository
import com.nantty.android.data.CreatorApplicationTransport
import com.nantty.android.data.CreatorPayoutAccountsTransport
import com.nantty.android.data.CreatorWorkspaceRepository
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CreatorApplicationFormTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun requiresCategoryAndTermsThenSubmitsAndShowsResultCallback() {
        var submittedBody: JSONObject? = null
        var submittedKey: String? = null
        var submittedStatus: String? = null
        val repository = CreatorWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            applicationTransport = CreatorApplicationTransport { _, _, key, body ->
                submittedBody = body
                submittedKey = key
                JSONObject("""{"id":"app-1","status":"pending","contentCategories":["tech"],"submittedAt":"2026-11-05T12:00:00Z","reviewedAt":null,"rejectionReason":null,"reapplyAvailableAt":null}""")
            },
            payoutAccountsTransport = CreatorPayoutAccountsTransport { _, _ ->
                JSONObject("""{"data":[{"id":"payout-1","bankName":"GTBank","accountNumberMasked":"••••4821","accountName":"Creator Name"}],"nextCursor":null}""")
            },
        )
        val directExecutor = Executor { command -> command.run() }

        compose.setContent {
            MaterialTheme {
                CreatorApplicationForm(
                    repository = repository,
                    executor = directExecutor,
                    onBack = {},
                    onReauthenticate = {},
                    onSubmitted = { submittedStatus = it.status },
                )
            }
        }

        compose.onNodeWithContentDescription("Add sample").assertIsDisplayed()
        compose.onNodeWithText("Submit application").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithText("Tech").performClick()
        compose.onNodeWithContentDescription("GTBank ••••4821, Creator Name").performClick()
        compose.onNodeWithContentDescription("I agree to the Creator Terms").performClick()
        compose.onNodeWithText("Submit application").performClick()

        assertNotNull(submittedBody)
        assertEquals("pending", submittedStatus)
        assertEquals(1, submittedBody?.getJSONArray("contentCategories")?.length())
        assertEquals("tech", submittedBody?.getJSONArray("contentCategories")?.getString(0))
        assertEquals("2026-09", submittedBody?.getString("acceptedCreatorTermsVersion"))
        assertEquals(0, submittedBody?.getJSONArray("sampleContentUrls")?.length())
        assertEquals("payout-1", submittedBody?.getString("payoutAccountId"))
        assertNotNull(submittedKey)
    }

    private fun signedInSession() = AccountSession(
        "creator-access",
        "creator-refresh",
        AccountUser("account-1", "Creator", "creator", null, null, emptyList()),
    )
}
