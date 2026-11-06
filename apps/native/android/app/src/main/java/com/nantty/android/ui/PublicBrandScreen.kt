package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.BrandFollowResult
import com.nantty.android.data.PublicBrand
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.PublicBrandResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfilePostsResult
import com.nantty.android.data.FeedPost
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun PublicBrandScreen(
    brandId: String,
    repository: PublicBrandRepository,
    profileRepository: PublicProfileRepository,
    onBack: () -> Unit,
    onOpenStore: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onRequireSignIn: () -> Unit,
    onRequireSignInWithAction: ((() -> Unit) -> Unit),
    isGuest: Boolean,
    modifier: Modifier = Modifier,
) {
    var brand by remember(brandId) { mutableStateOf<PublicBrand?>(null) }
    var officialProducts by remember(brandId) { mutableStateOf(emptyList<com.nantty.android.data.SearchProduct>()) }
    var otherProducts by remember(brandId) { mutableStateOf(emptyList<com.nantty.android.data.SearchProduct>()) }
    var loading by remember(brandId) { mutableStateOf(true) }
    var error by remember(brandId) { mutableStateOf<String?>(null) }
    var refreshKey by remember(brandId) { mutableStateOf(0) }
    var ownerPosts by remember(brandId) { mutableStateOf<List<FeedPost>>(emptyList()) }
    var ownerPostsLoading by remember(brandId) { mutableStateOf(false) }
    var followingBusy by remember(brandId) { mutableStateOf(false) }
    var followError by remember(brandId) { mutableStateOf<String?>(null) }
    var confirmUnfollow by remember(brandId) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(brandId, refreshKey) {
        loading = true
        error = null
        val result = withContext(Dispatchers.IO) { repository.load(brandId) }
        when (result) {
            is PublicBrandResult.Success -> {
                brand = result.page.brand
                officialProducts = result.page.products.officialStore
                otherProducts = result.page.products.otherSellers
            }
            is PublicBrandResult.Failure -> error = result.message
        }
        loading = false
    }

    LaunchedEffect(brand?.ownerUserId) {
        val ownerId = brand?.ownerUserId ?: return@LaunchedEffect
        ownerPostsLoading = true
        ownerPosts = withContext(Dispatchers.IO) {
            when (val result = profileRepository.loadPosts(ownerId, visibility = "public")) {
                is PublicProfilePostsResult.Success -> result.page.posts.take(BRAND_PROFILE_POST_LIMIT)
                is PublicProfilePostsResult.Failure -> emptyList()
            }
        }
        ownerPostsLoading = false
    }

    fun toggleFollow() {
        val current = brand ?: return
        if (followingBusy) return
        followingBusy = true
        followError = null
        scope.launch {
            val result = withContext(Dispatchers.IO) { repository.setFollowing(current.id, !current.isFollowing) }
            when (result) {
                is BrandFollowResult.Success -> brand = brand?.copy(
                    isFollowing = result.following,
                    followers = (current.followers + if (result.following) 1 else -1).coerceAtLeast(0),
                )
                is BrandFollowResult.Failure -> {
                    if (result.authenticationRequired) onRequireSignIn() else followError = result.message
                }
            }
            followingBusy = false
        }
    }

    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().widthIn(max = 1040.dp).padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back" }) {
                Icon(Icons.Default.ArrowBack, contentDescription = null)
                Text("Back")
            }
        }
        when {
            loading && brand == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            error != null && brand == null -> SearchCenterMessage("Brand is unavailable", error, action = { refreshKey++ })
            brand != null -> PublicBrandContent(
                brand = brand!!,
                officialProducts = officialProducts,
                otherProducts = otherProducts,
                ownerPosts = ownerPosts,
                ownerPostsLoading = ownerPostsLoading,
                followingBusy = followingBusy,
                followError = followError,
                onFollow = {
                    when {
                        brand!!.isFollowing -> confirmUnfollow = true
                        isGuest -> onRequireSignInWithAction(::toggleFollow)
                        else -> toggleFollow()
                    }
                },
                onOpenStore = onOpenStore,
                onOpenProduct = onOpenProduct,
                onOpenPost = onOpenPost,
            )
        }
    }
    if (confirmUnfollow) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmUnfollow = false },
            title = { Text("Unfollow ${brand?.name.orEmpty()}?") },
            text = { Text("You’ll stop seeing updates from this brand in your followed accounts.") },
            confirmButton = { TextButton(onClick = { confirmUnfollow = false; toggleFollow() }) { Text("Unfollow") } },
            dismissButton = { TextButton(onClick = { confirmUnfollow = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun PublicBrandContent(
    brand: PublicBrand,
    officialProducts: List<com.nantty.android.data.SearchProduct>,
    otherProducts: List<com.nantty.android.data.SearchProduct>,
    ownerPosts: List<FeedPost>,
    ownerPostsLoading: Boolean,
    followingBusy: Boolean,
    followError: String?,
    onFollow: () -> Unit,
    onOpenStore: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
    onOpenPost: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth().widthIn(max = 1040.dp).testTag("public-brand-content"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "brand-header") {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("brand-header")) {
                brand.coverUrl?.let { cover ->
                    AsyncImage(cover, contentDescription = "${brand.name} brand cover", modifier = Modifier.fillMaxWidth().height(160.dp), contentScale = ContentScale.Crop)
                }
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(Modifier.size(64.dp), color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
                        if (brand.logoUrl != null) AsyncImage(brand.logoUrl, contentDescription = "${brand.name} brand logo", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        else Box(contentAlignment = Alignment.Center) { Text(brand.name.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge) }
                    }
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(brand.name, modifier = Modifier.weight(1f, fill = false).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            if (brand.official) Icon(Icons.Default.Verified, contentDescription = "Verified brand", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp).size(18.dp))
                        }
                        Text("@${brand.handle}", color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Text(
                    listOfNotNull("${brand.followers} followers", brand.categoryName.takeIf(String::isNotBlank)).joinToString(" · "),
                    Modifier.fillMaxWidth().padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (brand.description.isNotBlank()) Text(brand.description, Modifier.fillMaxWidth().padding(top = 10.dp), style = MaterialTheme.typography.bodyMedium)
                brand.website?.let { Text(it, Modifier.fillMaxWidth().padding(top = 6.dp), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
                Button(onClick = onFollow, enabled = !followingBusy, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).testTag("brand-follow-button")) {
                    if (followingBusy) CircularProgressIndicator(Modifier.size(18.dp)) else Text(if (brand.isFollowing) "Following" else "Follow brand")
                }
                followError?.let { Text(it, Modifier.fillMaxWidth().padding(top = 4.dp), color = MaterialTheme.colorScheme.error) }
                Spacer(Modifier.height(8.dp))
            }
        }
        if (brand.sellingEnabled && brand.officialStoreId != null) {
            item(key = "brand-official-store") {
                TextButton(onClick = { onOpenStore(brand.officialStoreId) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).testTag("brand-official-store")) {
                    Text("Visit ${brand.officialStoreName ?: "official store"}")
                }
            }
        }
        if (brand.sellingEnabled) {
            item(key = "brand-official-products-heading") { BrandProductHeading("Official store") }
            if (officialProducts.isEmpty()) {
                item(key = "brand-official-products-empty") { Text("No official-store products available.", Modifier.fillMaxWidth().padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else {
                items(officialProducts, key = { "official:${it.id}" }) { product -> SearchProductRow(product) { onOpenProduct(product.id) } }
            }
        }
        if (otherProducts.isNotEmpty()) {
            item(key = "brand-other-products-heading") {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                    BrandProductHeading("Also sold by other sellers")
                    Text("Independent sellers — not the official store.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            items(otherProducts, key = { "other:${it.id}" }) { product -> SearchProductRow(product) { onOpenProduct(product.id) } }
        }
        if (ownerPostsLoading || ownerPosts.isNotEmpty()) {
            item(key = "brand-owner-posts-heading") { BrandProductHeading("Posts") }
            if (ownerPostsLoading && ownerPosts.isEmpty()) {
                item(key = "brand-owner-posts-loading") { Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            } else {
                items(ownerPosts, key = { "owner-post:${it.id}" }) { post -> FeedCard(post = post, onOpenPost = onOpenPost) }
            }
        }
    }
}

@Composable
private fun BrandProductHeading(title: String) {
    Text(title, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
}

private const val BRAND_PROFILE_POST_LIMIT = 3
