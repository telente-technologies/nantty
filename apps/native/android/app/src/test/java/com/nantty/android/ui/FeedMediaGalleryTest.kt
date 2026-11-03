package com.nantty.android.ui

import com.nantty.android.data.FeedMedia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeedMediaGalleryTest {
    @Test
    fun mapsMixedFeedPagesToTheirImageOnlyPreviewIndex() {
        val media = listOf(
            image("image-1"),
            video("video-1"),
            image("image-2"),
        )

        assertEquals(0, imageIndexForMediaPage(media, 0))
        assertNull(imageIndexForMediaPage(media, 1))
        assertEquals(1, imageIndexForMediaPage(media, 2))
        assertNull(imageIndexForMediaPage(media, 3))
    }

    private fun image(id: String) = FeedMedia(id, "image", "https://cdn.nantty.com/$id.jpg", null, 1200, 800)

    private fun video(id: String) = FeedMedia(id, "video", "https://cdn.nantty.com/$id.mp4", null, 1920, 1080)
}
