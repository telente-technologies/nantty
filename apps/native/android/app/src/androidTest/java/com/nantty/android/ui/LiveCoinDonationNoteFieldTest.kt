package com.nantty.android.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTextInput
import com.nantty.android.ui.live.LiveCoinDonationNoteField
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LiveCoinDonationNoteFieldTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun limitsInputByUnicodeCharactersWithoutSplittingSurrogatePairs() {
        val note = mutableStateOf("")
        compose.setContent {
            LiveCoinDonationNoteField(note.value, { note.value = it }, enabled = true)
        }

        compose.onNodeWithTag("live-coin-donation-note").performTextInput("😀".repeat(281))

        compose.runOnIdle {
            assertEquals(280, note.value.codePointCount(0, note.value.length))
            assertEquals("😀".repeat(280), note.value)
        }
        compose.onNodeWithTag("live-coin-donation-note").assertTextContains("280/280")
    }
}
