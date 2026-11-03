package com.nantty.android.share

import android.content.ComponentName
import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PostShareChooserTest {
    @Test
    fun feedShareTextMatchesMobileAuthorAndPostLinkFormat() {
        assertEquals(
            "Ari on Nantty: https://web.nantty.com/post/post-123",
            postShareText("post-123", "Ari"),
        )
    }

    @Test
    fun postDetailShareTextContainsTheCanonicalPostLink() {
        assertEquals("https://web.nantty.com/post/post-123", postShareText("post-123"))
    }

    @Test
    fun postShareUrlUsesConfiguredHttpsWebAppOrigin() {
        assertEquals(
            "https://staging.nantty.example/post/post-123",
            postShareText("post-123", webAppBaseUrl = "https://staging.nantty.example/"),
        )
    }

    @Test
    fun insecureNonEmulatorWebAppOriginFallsBackToCanonicalHttpsOrigin() {
        assertEquals(
            "https://web.nantty.com/post/post-123",
            postShareText("post-123", webAppBaseUrl = "http://staging.nantty.example"),
        )
    }

    @Test
    fun legacyChooserCallbackRequiresASelectedComponent() {
        val selected = ComponentName("com.example.share", "com.example.share.TargetActivity")
        assertEquals(selected, selectedShareTarget(Intent().putExtra(Intent.EXTRA_CHOSEN_COMPONENT, selected), sdkInt = 34))
        assertNull(selectedShareTarget(Intent(), sdkInt = 34))
    }
}
