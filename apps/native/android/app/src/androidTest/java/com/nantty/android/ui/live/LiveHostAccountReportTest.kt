package com.nantty.android.ui.live

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LiveHostAccountReportTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun reportHostSubmitsAnAccountReportForTheHostUser() {
        var submittedBody: JSONObject? = null
        val repository = ProductReportRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            transport = ProductReportTransport { _, _, _, body ->
                submittedBody = body
                JSONObject("""{"data":{"id":"report-1","status":"received"}}""")
            },
        )
        compose.setContent {
            MaterialTheme {
                LiveHostAccountReportAction("live-1", "host-user-42", "hosthandle", repository, java.util.concurrent.Executor { it.run() }, {})
            }
        }

        compose.onNodeWithText("Report @hosthandle").assertIsDisplayed()
        compose.onNodeWithTag("live-host-report-open").performClick()
        compose.onNodeWithTag("user-report-reason-spam").performClick()
        compose.onNodeWithText("Submit report").performClick()
        compose.onNodeWithText("Thanks for letting us know").assertIsDisplayed()

        assertEquals("user", submittedBody?.getString("targetType"))
        assertEquals("host-user-42", submittedBody?.getString("targetId"))
        assertEquals("host-user-42", submittedBody?.getString("reportedUserId"))
    }
}
