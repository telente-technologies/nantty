package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import android.icu.text.CompactDecimalFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.PostAnalytics
import com.nantty.android.data.PostAnalyticsRepository
import com.nantty.android.data.PostAnalyticsResult
import java.util.Locale
import java.util.concurrent.Executor
import kotlin.math.ceil

@Composable
internal fun PostAnalyticsScreen(
    postId: String,
    repository: PostAnalyticsRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var result by remember(postId) { mutableStateOf<PostAnalyticsResult?>(null) }
    var loading by remember(postId) { mutableStateOf(true) }
    var retryGeneration by remember(postId) { mutableIntStateOf(0) }

    BackHandler(onBack = onBack)
    LaunchedEffect(postId, retryGeneration, repository, executor) {
        loading = true
        executor.execute {
            val loaded = repository.load(postId)
            Snapshot.withMutableSnapshot {
                result = loaded
                loading = false
            }
        }
    }
    LaunchedEffect(result) {
        if ((result as? PostAnalyticsResult.Failure)?.authenticationRequired == true) onReauthenticate()
    }

    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) {
        val success = (result as? PostAnalyticsResult.Success)?.analytics
        val backDescription = stringResource(R.string.post_analytics_back)
        Row(
            Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = backDescription }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text(
                text = stringResource(if (success?.kind == "clip") R.string.clip_analytics_title else R.string.post_analytics_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        when {
            success != null -> PostAnalyticsContent(success)
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                val loadingDescription = stringResource(R.string.post_analytics_loading)
                CircularProgressIndicator(Modifier.semantics { contentDescription = loadingDescription })
            }
            else -> PostAnalyticsFailure(
                result as? PostAnalyticsResult.Failure,
                onRetry = { retryGeneration += 1 },
            )
        }
    }
}

@Composable
private fun PostAnalyticsFailure(failure: PostAnalyticsResult.Failure?, onRetry: () -> Unit) {
    val privateFailure = failure?.message?.contains("private", ignoreCase = true) == true
    val missingFailure = failure?.message?.contains("isn't available", ignoreCase = true) == true
    val title = when {
        privateFailure -> stringResource(R.string.post_analytics_private_title)
        missingFailure -> stringResource(R.string.post_analytics_missing_title)
        else -> stringResource(R.string.post_analytics_error_title)
    }
    val detail = when {
        privateFailure -> stringResource(R.string.post_analytics_private_body)
        missingFailure -> stringResource(R.string.post_analytics_missing_body)
        else -> stringResource(R.string.post_analytics_error_body)
    }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(detail, Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (!privateFailure && !missingFailure) {
            Button(onClick = onRetry, modifier = Modifier.padding(top = 16.dp).testTag("post-analytics-retry")) {
                Text(stringResource(R.string.post_analytics_retry))
            }
        }
    }
}

@Composable
private fun PostAnalyticsContent(data: PostAnalytics) {
    val summaryMetrics = listOf(
        stringResource(R.string.post_analytics_impressions) to formatCount(data.impressions),
        stringResource(R.string.post_analytics_unique_viewers) to formatCount(data.uniqueViewers),
        stringResource(R.string.post_analytics_profile_visits) to formatCount(data.profileVisits),
        stringResource(R.string.post_analytics_engagements) to formatCount(data.engagements),
        stringResource(R.string.post_analytics_engagement_rate) to "${data.engagementRate}%",
        stringResource(R.string.post_analytics_new_follows) to formatCount(data.newFollows),
    )
    val videoMetrics = data.video?.let { video ->
        val average = video.averageWatchSeconds ?: if (video.views > 0) video.watchTimeSeconds.toDouble() / video.views else 0.0
        val completion = video.completionRate?.takeIf { video.views > 0 }?.let {
            stringResource(R.string.post_analytics_completion_rate) to "${(it * 100).toInt()}%"
        }
        listOf(
            stringResource(R.string.post_analytics_video_views) to formatCount(video.views),
            stringResource(R.string.post_analytics_watch_time) to formatDuration(video.watchTimeSeconds.toDouble()),
            stringResource(R.string.post_analytics_average_watch_time) to formatDuration(average),
        ) + listOfNotNull(completion)
    }
    val videoHeading = stringResource(if (data.kind == "clip") R.string.post_analytics_watching else R.string.post_analytics_video_views)
    val commentLabel = stringResource(if (data.kind == "clip") R.string.post_analytics_comments else R.string.post_analytics_replies)
    val engagementRows = listOf(
        stringResource(R.string.post_analytics_likes) to formatCount(data.likes),
        commentLabel to formatCount(data.comments),
        stringResource(R.string.post_analytics_reposts) to formatCount(data.reposts),
        stringResource(R.string.post_analytics_saves) to formatCount(data.saves),
        stringResource(R.string.post_analytics_shares) to formatCount(data.shares),
    ) + if (data.hasLink || data.linkClicks > 0) {
        listOf(stringResource(R.string.post_analytics_link_clicks) to formatCount(data.linkClicks))
    } else emptyList()
    val engagementHeading = stringResource(R.string.post_analytics_engagements_heading)
    val audienceHeading = stringResource(R.string.post_analytics_audience)
    val postHeading = stringResource(if (data.kind == "clip") R.string.post_analytics_this_clip else R.string.post_analytics_this_post)
    val postRows = listOf(
        stringResource(R.string.post_analytics_likes) to formatCount(data.likes),
        commentLabel to formatCount(data.comments),
    )
    LazyColumn(
        Modifier.fillMaxSize().testTag("post-analytics-content"),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item("owner-note") {
            Text(
                stringResource(R.string.post_analytics_owner_note),
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        item("summary") {
            AnalyticsMetricGrid(summaryMetrics)
        }
        if (videoMetrics != null) {
            item("video-heading") {
                Text(
                    videoHeading,
                    Modifier.padding(horizontal = 16.dp),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            item("video-metrics") { AnalyticsMetricGrid(videoMetrics) }
        }
        item("daily-chart") { DailyImpressionsCard(data) }
        item("engagements") { AnalyticsRowsCard(engagementHeading, engagementRows) }
        if (data.audience.isNotEmpty()) {
            item("audience") {
                AnalyticsRowsCard(
                    title = audienceHeading,
                    rows = data.audience.map { it.label to "${it.share}%" },
                )
            }
        }
        item("post-details") {
            AnalyticsRowsCard(
                title = postHeading,
                rows = postRows,
                subtitle = data.authorName,
            )
        }
        item("bottom-space") { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun AnalyticsMetricGrid(metrics: List<Pair<String, String>>) {
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        val columns = if (maxWidth >= 600.dp) 3 else 2
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            metrics.chunked(columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (label, value) ->
                        Card(
                            Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        ) {
                            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                                Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun DailyImpressionsCard(data: PostAnalytics) {
    val peak = data.daily.maxOfOrNull { it.impressions }?.coerceAtLeast(1) ?: 1
    val title = stringResource(R.string.post_analytics_last_seven_days)
    AnalyticsCard(title = title) {
        Row(
            Modifier.fillMaxWidth().height(156.dp).semantics {
                contentDescription = title
            },
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            data.daily.forEach { item ->
                Column(
                    Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                ) {
                    val barHeight = (item.impressions.toFloat() / peak * 112f).coerceAtLeast(4f)
                    Box(
                        Modifier.fillMaxWidth().height(barHeight.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(6.dp)),
                    )
                    Text(item.day.takeLast(2), Modifier.padding(top = 6.dp), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun AnalyticsRowsCard(title: String, rows: List<Pair<String, String>>, subtitle: String? = null) {
    AnalyticsCard(title = title, subtitle = subtitle) {
        rows.forEachIndexed { index, (label, value) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, fontWeight = FontWeight.SemiBold)
            }
            if (index < rows.lastIndex) {
                Surface(Modifier.fillMaxWidth().height(1.dp), color = MaterialTheme.colorScheme.outlineVariant) {}
            }
        }
    }
}

@Composable
private fun AnalyticsCard(title: String, subtitle: String? = null, content: @Composable () -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            content()
        }
    }
}

private fun formatCount(value: Int): String = CompactDecimalFormat
    .getInstance(Locale.getDefault(), CompactDecimalFormat.CompactStyle.SHORT)
    .format(value)

private fun formatDuration(secondsValue: Double): String {
    val seconds = ceil(secondsValue.coerceAtLeast(0.0)).toInt()
    if (seconds < 60) return "${seconds}s"
    if (seconds < 3_600) {
        val minutes = seconds / 60
        val remainder = seconds % 60
        return if (remainder == 0) "${minutes}m" else "${minutes}m ${remainder}s"
    }
    val hours = seconds / 3_600
    val minutes = (seconds % 3_600) / 60
    return if (minutes == 0) "${hours}h" else "${hours}h ${minutes}m"
}

