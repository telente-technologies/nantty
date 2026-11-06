package com.nantty.android.ui.stories

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import coil.compose.AsyncImage
import com.nantty.android.data.StoryAdDestination
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryDecidedAd
import com.nantty.android.ui.clips.ClipVideoPlayer
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

/** Sponsored interstitial mirroring React Native's existing story ad page. */
@Composable
internal fun SponsoredStoryPage(
    ad: StoryDecidedAd,
    repository: StoryAdsRepository,
    executor: Executor,
    onFinished: () -> Unit,
    onOpenDestination: (StoryAdDestination) -> Unit,
) {
    var elapsedSeconds by remember(ad.adId) { mutableIntStateOf(0) }
    val media = ad.media.firstOrNull()
    val skipAfterSeconds = ad.skipAfterSeconds?.coerceAtLeast(0) ?: IMAGE_AD_SECONDS
    val canSkip = elapsedSeconds >= skipAfterSeconds

    LaunchedEffect(ad.adId, repository, executor) {
        executor.execute { repository.recordImpression(ad) }
        val startedAt = System.nanoTime()
        while (true) {
            delay(250)
            elapsedSeconds = ((System.nanoTime() - startedAt) / 1_000_000_000L).toInt()
            if (media?.kind != "video" && elapsedSeconds >= IMAGE_AD_SECONDS) {
                onFinished()
                break
            }
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black).testTag("story-sponsored-page")) {
                when {
                    media?.kind == "video" -> ClipVideoPlayer(
                        videoUrl = media.url,
                        muted = false,
                        isActive = true,
                        modifier = Modifier.fillMaxSize(),
                        loop = false,
                    )
                    media != null -> AsyncImage(
                        model = media.url,
                        contentDescription = "Sponsored story",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }

                Row(
                    modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (!ad.identity.avatarUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = ad.identity.avatarUrl,
                            contentDescription = null,
                            modifier = Modifier.size(36.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        Text(ad.identity.name, color = Color.White, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1)
                        Text(ad.label, color = Color.White, style = MaterialTheme.typography.labelSmall)
                    }
                    if (canSkip) {
                        TextButton(onClick = onFinished, modifier = Modifier.testTag("story-ad-skip")) {
                            Text("Skip", color = Color.White)
                        }
                    }
                }

                Column(
                    modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(ad.headline, color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2)
                    if (ad.primaryText.isNotBlank()) {
                        Text(ad.primaryText, color = Color.White, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
                    }
                    Button(
                        onClick = {
                            executor.execute { repository.recordClick(ad) }
                            onOpenDestination(ad.destination)
                        },
                        modifier = Modifier.testTag("story-ad-cta"),
                    ) {
                        Text(ad.callToAction.ifBlank { "Learn more" })
                    }
                }
    }
}

private const val IMAGE_AD_SECONDS = 6
