package com.nantty.android.ui.live

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.nantty.android.data.MAX_LIVE_TIP_NOTE_CODE_POINTS
import com.nantty.android.data.limitLiveTipNote

@Composable
internal fun LiveCoinDonationNoteField(
    note: String,
    onNoteChanged: (String) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = note,
        onValueChange = { onNoteChanged(limitLiveTipNote(it)) },
        enabled = enabled,
        label = { Text("Add a note (optional)") },
        supportingText = {
            Text(
                "${note.codePointCount(0, note.length)}/$MAX_LIVE_TIP_NOTE_CODE_POINTS",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        minLines = 1,
        maxLines = 3,
        modifier = modifier.fillMaxWidth().testTag("live-coin-donation-note"),
    )
}
