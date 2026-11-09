package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.CreatorWorkspaceTransport
import com.nantty.android.data.CreatorAffiliatesRepository
import com.nantty.android.data.CreatorAffiliatesTransport
import com.nantty.android.data.CreatorAffiliatesResponse
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CreatorWorkspaceScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun eligibilityShowsDecisionBadgeAndServerDerivedAccessibleProgress() {
        val repository = CreatorWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = CreatorWorkspaceTransport { path, _ ->
                when (path) {
                    CreatorWorkspaceRepository.ELIGIBILITY_PATH -> JSONObject(
                        """{"eligible":false,"decision":"manual_review","decisionNote":"A review is still required.","requirements":[{"key":"followers","label":"Followers","currentValue":25,"requiredValue":100,"met":false}]}""",
                    )
                    CreatorWorkspaceRepository.APPLICATION_PATH -> JSONObject("""{"data":null}""")
                    else -> error("Unexpected path: $path")
                }
            },
        )
        val directExecutor = Executor { command -> command.run() }
        val affiliatesRepository = CreatorAffiliatesRepository(
            sessionProvider = ::signedInSession,
            transport = CreatorAffiliatesTransport { _, _, _, _ -> CreatorAffiliatesResponse(500, "{}") },
        )

        compose.setContent {
            MaterialTheme {
                CreatorWorkspaceScreen(repository = repository, affiliatesRepository = affiliatesRepository, executor = directExecutor)
            }
        }

        compose.onNodeWithText("Manual review").assertIsDisplayed()
        compose.onNodeWithText("Followers").assertIsDisplayed()
        compose.onNodeWithText("25 / 100").assertIsDisplayed()
        compose.onNodeWithContentDescription("Followers progress").assertIsDisplayed()
    }

    private fun signedInSession() = AccountSession(
        "creator-access",
        "creator-refresh",
        AccountUser("account-1", "Creator", "creator", null, null, emptyList()),
    )
}
