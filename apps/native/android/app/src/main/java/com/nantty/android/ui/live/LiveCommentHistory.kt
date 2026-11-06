package com.nantty.android.ui.live

import com.nantty.android.data.LiveComment

/** Merges the polled newest page with older cursor pages without losing chronological order. */
internal fun mergeLiveCommentHistory(existing: List<LiveComment>, incoming: List<LiveComment>): List<LiveComment> =
    (existing + incoming)
        .filterNot { it.kind == "gift" }
        .associateBy(LiveComment::id)
        .values
        .sortedWith(compareBy<LiveComment>(LiveComment::createdAt).thenBy(LiveComment::id))
