package com.nantty.android.ui.live

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportTransport
import com.nantty.android.ui.theme.NanttyTheme
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor

class LiveReportDialogTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun reportCapturesReasonDetailsAndMomentForTheModerationApi() {
        var capturedBody: JSONObject? = null
        val reports = ProductReportRepository(
            accessTokenProvider = { "access-token" },
            transport = ProductReportTransport { _, _, _, body ->
                capturedBody = body
                JSONObject("""{"data":{"id":"report-1","status":"received"}}""")
            },
        )
        compose.setContent {
            NanttyTheme {
                LiveReportDialog(true, "live-1", "2026-11-06T12:00:00Z", reports, Executor { it.run() }, {}, {})
            }
        }

        compose.onNodeWithTag("live-report-reason-child_safety").performClick()
        compose.onNodeWithTag("live-report-details").performTextInput("Please review this speaker")
        compose.onNodeWithTag("live-report-submit").performClick()
        compose.onNodeWithText("Our safety team will review this Live. We won’t tell the host who reported it.").assertIsDisplayed()

        assertEquals("live", capturedBody?.getString("targetType"))
        assertEquals("child_safety", capturedBody?.getString("reason"))
        assertEquals("Please review this speaker", capturedBody?.getString("details"))
        assertEquals("live-1", capturedBody?.getString("targetId"))
        val context = capturedBody?.getJSONObject("liveContext")
        val frameRef = context?.getString("frameRef").orEmpty()
        assertTrue(frameRef.startsWith("live:live-1@"))
        assertEquals(frameRef.removePrefix("live:live-1@"), context?.getString("capturedAt"))
    }
}
