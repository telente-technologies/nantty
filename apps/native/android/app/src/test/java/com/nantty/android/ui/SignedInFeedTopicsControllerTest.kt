package com.nantty.android.ui

import androidx.compose.runtime.mutableStateOf
import com.nantty.android.data.FeedRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.Executor

class SignedInFeedTopicsControllerTest {
    @Test
    fun publishesAuthenticationFailureAndClearsLoading() {
        val state = mutableStateOf(SignedInFeedTopicsState())
        val controller = SignedInFeedTopicsController(
            repository = FeedRepository(baseUrl = "https://api.nantty.example"),
            executor = Executor { it.run() },
            state = state,
        )

        controller.load(accessToken = null)

        assertEquals("Sign in again to load your followed topics.", state.value.error)
        assertFalse(state.value.loading)
        assertTrue(state.value.topics.isEmpty())
    }
}
