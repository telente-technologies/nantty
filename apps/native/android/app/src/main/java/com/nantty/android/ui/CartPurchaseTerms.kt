package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics

@Composable
internal fun CartPurchaseTerms(modifier: Modifier = Modifier) {
    val uriHandler = LocalUriHandler.current
    FlowRow(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("By purchasing, you agree to our ", style = MaterialTheme.typography.bodySmall)
        Text(
            "Terms of Service",
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.clickable { runCatching { uriHandler.openUri(TERMS_URL) } }
                .semantics { role = Role.Button },
        )
        Text(" and ", style = MaterialTheme.typography.bodySmall)
        Text(
            "Privacy Policy",
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.clickable { runCatching { uriHandler.openUri(PRIVACY_URL) } }
                .semantics { role = Role.Button },
        )
    }
}

private const val TERMS_URL = "https://nantty.com/terms"
private const val PRIVACY_URL = "https://nantty.com/privacy"
