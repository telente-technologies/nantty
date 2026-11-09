package com.nantty.android.ui

import com.nantty.android.data.FeedPost
import com.nantty.android.data.ExploreSuggestion
import com.nantty.android.data.ClipFeedItem

/** Returns list indexes after which a module is inserted, counting every visible feed row like the RN slot planner. */
internal fun feedRowInsertionBoundaries(posts: List<FeedPost>, firstAfterRows: Int, repeatEveryRows: Int): List<Int> {
    require(firstAfterRows > 0 && repeatEveryRows > 0)
    return buildList {
        posts.indices.forEach { index ->
            val rowCount = index + 1
            if (rowCount >= firstAfterRows && (rowCount - firstAfterRows) % repeatEveryRows == 0) add(rowCount)
        }
    }
}

/** Product recommendation cadence is explicitly organic-post based in React Native. */
internal fun organicPostInsertionBoundaries(posts: List<FeedPost>, firstAfterOrganicPosts: Int, repeatEveryOrganicPosts: Int): List<Int> {
    require(firstAfterOrganicPosts > 0 && repeatEveryOrganicPosts > 0)
    var organicCount = 0
    return buildList {
        posts.forEachIndexed { index, post ->
            if (post.isSponsored) return@forEachIndexed
            organicCount += 1
            if (organicCount >= firstAfterOrganicPosts &&
                (organicCount - firstAfterOrganicPosts) % repeatEveryOrganicPosts == 0
            ) add(index + 1)
        }
    }
}

internal const val PEOPLE_YOU_MAY_KNOW_FIRST_AFTER_ROWS = 10
internal const val PEOPLE_YOU_MAY_KNOW_REPEAT_EVERY_ROWS = 30
internal const val PEOPLE_YOU_MAY_KNOW_PER_ROW = 10
internal const val PEOPLE_YOU_MAY_KNOW_MINIMUM_PER_ROW = 2
internal const val GET_VERIFIED_FIRST_AFTER_ROWS = 3
internal const val PRODUCT_RECOMMENDATION_FIRST_AFTER_POSTS = 16
internal const val PRODUCT_RECOMMENDATION_REPEAT_EVERY_POSTS = 45
internal const val SUGGESTED_CLIPS_FIRST_AFTER_ROWS = 6
internal const val SUGGESTED_CLIPS_REPEAT_EVERY_ROWS = 18
internal const val SUGGESTED_CLIPS_PER_ROW = 8
internal const val SUGGESTED_CLIPS_MINIMUM_PER_ROW = 3

/** RN offers Get Verified once when a signed-in card is visible and the feed has enough loaded rows. */
internal fun getVerifiedInsertionBoundary(postCount: Int, visible: Boolean): Int? =
    GET_VERIFIED_FIRST_AFTER_ROWS.takeIf { visible && postCount > it }

internal fun peopleYouMayKnowInsertions(
    posts: List<FeedPost>,
    suggestions: List<ExploreSuggestion>,
): List<Pair<Int, List<ExploreSuggestion>>> {
    var occurrence = 0
    return buildList {
        feedRowInsertionBoundaries(posts, PEOPLE_YOU_MAY_KNOW_FIRST_AFTER_ROWS, PEOPLE_YOU_MAY_KNOW_REPEAT_EVERY_ROWS)
            .forEach { boundary ->
                val chunk = suggestions.drop(occurrence * PEOPLE_YOU_MAY_KNOW_PER_ROW).take(PEOPLE_YOU_MAY_KNOW_PER_ROW)
                if (chunk.size >= PEOPLE_YOU_MAY_KNOW_MINIMUM_PER_ROW) {
                    add(boundary to chunk)
                    occurrence += 1
                }
            }
    }
}

internal fun suggestedClipsInsertions(
    posts: List<FeedPost>,
    clips: List<ClipFeedItem>,
): List<Pair<Int, List<ClipFeedItem>>> {
    var occurrence = 0
    return buildList {
        feedRowInsertionBoundaries(posts, SUGGESTED_CLIPS_FIRST_AFTER_ROWS, SUGGESTED_CLIPS_REPEAT_EVERY_ROWS)
            .forEach { boundary ->
                val chunk = clips.drop(occurrence * SUGGESTED_CLIPS_PER_ROW).take(SUGGESTED_CLIPS_PER_ROW)
                if (chunk.size >= SUGGESTED_CLIPS_MINIMUM_PER_ROW) {
                    add(boundary to chunk)
                    occurrence += 1
                }
            }
    }
}
