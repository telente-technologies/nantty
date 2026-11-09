package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Podcasts
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

@Composable
internal fun AppHeader(
    onRefresh: () -> Unit,
    onOpenMart: () -> Unit,
    onOpenOrders: () -> Unit,
    accountUser: com.nantty.android.data.AccountUser?,
    onSignOut: () -> Unit,
    onOpenCart: () -> Unit = {},
) {
    var overflowExpanded by rememberSaveable { mutableStateOf(false) }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val compact = maxWidth < WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND.dp
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BrandMark()
            Spacer(Modifier.width(12.dp))
            if (!compact) {
                Text("nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onOpenMart, modifier = Modifier.semantics { contentDescription = "Open Mart" }) {
                Icon(Icons.Default.Storefront, contentDescription = null)
            }
            if (accountUser != null) {
                IconButton(onClick = onOpenCart, modifier = Modifier.semantics { contentDescription = "Open cart" }) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = null)
                }
                IconButton(onClick = onOpenOrders, modifier = Modifier.semantics { contentDescription = "Open my orders" }) {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null)
                }
            }
            if (compact) {
                Box {
                    IconButton(
                        onClick = { overflowExpanded = true },
                        modifier = Modifier.semantics { contentDescription = "More account actions" },
                    ) {
                        Icon(Icons.Default.MoreVert, contentDescription = null)
                    }
                    DropdownMenu(expanded = overflowExpanded, onDismissRequest = { overflowExpanded = false }) {
                        Text(
                            accountUser?.let { "${it.name} · @${it.username}" } ?: "Browsing as guest",
                            Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        DropdownMenuItem(
                            text = { Text("Refresh feed") },
                            leadingIcon = { Icon(Icons.Default.Refresh, contentDescription = null) },
                            onClick = { overflowExpanded = false; onRefresh() },
                        )
                        DropdownMenuItem(
                            text = { Text(if (accountUser == null) "Sign in" else "Sign out") },
                            onClick = { overflowExpanded = false; onSignOut() },
                        )
                    }
                }
            } else {
                Text(accountUser?.name ?: "Browsing as guest", Modifier.padding(end = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
                TextButton(onClick = onSignOut) { Text(if (accountUser == null) "Sign in" else "Sign out") }
                TextButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh feed")
                    Spacer(Modifier.width(6.dp))
                    Text("Refresh")
                }
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
internal fun BrandMark() {
    Box(Modifier.size(38.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
        Text("n", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
internal fun DestinationIcon(destination: Destination) {
    val image = when (destination) {
        Destination.Feed -> Icons.Default.Home
        Destination.Clips -> Icons.Default.PlayArrow
        Destination.Mart -> Icons.Default.Storefront
        Destination.Discover -> Icons.Default.Explore
        Destination.Spaces -> Icons.Default.Podcasts
        Destination.Live -> Icons.Default.LiveTv
        Destination.Notifications -> Icons.Default.NotificationsNone
        Destination.Messages -> Icons.Outlined.ChatBubbleOutline
        Destination.Wallet -> Icons.Default.AccountBalanceWallet
        Destination.Orders -> Icons.Default.ReceiptLong
        Destination.Profile -> Icons.Default.PersonOutline
        Destination.Saved -> Icons.Default.BookmarkBorder
        Destination.Business -> Icons.Default.Storefront
        Destination.FollowRequests -> Icons.Default.PersonOutline
        Destination.GroupInvitations -> Icons.Outlined.ChatBubbleOutline
        Destination.AccountStatus -> Icons.Default.Settings
        Destination.IdentityVerification -> Icons.Default.Settings
        Destination.SupportRequests -> Icons.Default.Settings
        Destination.DisputeDetail -> Icons.AutoMirrored.Filled.ReceiptLong
        Destination.CountryPreference -> Icons.Default.Settings
        Destination.ShippingAddresses -> Icons.Default.Settings
        Destination.ContentPreferences -> Icons.Default.Settings
        Destination.MentionPrivacy -> Icons.Default.Settings
        Destination.ChatNotificationSettings -> Icons.Default.Settings
        Destination.ChatPasscode -> Icons.Default.Settings
    }
    Icon(image, contentDescription = null)
}

