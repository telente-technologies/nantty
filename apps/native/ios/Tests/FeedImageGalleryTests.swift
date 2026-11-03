import XCTest
@testable import Nantty

final class FeedImageGalleryTests: XCTestCase {
    func testReadyImageGalleryKeepsImageOrderAndExcludesVideosPendingAndMissingURLs() throws {
        let media = [
            FeedPost.Media(id: "image-1", type: "image", url: URL(string: "https://cdn.nantty.test/1.jpg"), posterUrl: nil, status: "ready"),
            FeedPost.Media(id: "video-1", type: "video", url: URL(string: "https://cdn.nantty.test/1.mp4"), posterUrl: URL(string: "https://cdn.nantty.test/1.jpg"), status: "ready"),
            FeedPost.Media(id: "image-pending", type: "image", url: URL(string: "https://cdn.nantty.test/pending.jpg"), posterUrl: nil, status: "processing"),
            FeedPost.Media(id: "image-no-url", type: "image", url: nil, posterUrl: nil, status: "ready"),
            FeedPost.Media(id: "image-2", type: "image", url: URL(string: "https://cdn.nantty.test/2.jpg"), posterUrl: nil, status: "ready")
        ]

        let items = FeedImageGalleryItem.readyImages(from: media)

        XCTAssertEqual(items.map(\.id), ["image-1", "image-2"])
        XCTAssertEqual(items.map(\.url.absoluteString), [
            "https://cdn.nantty.test/1.jpg",
            "https://cdn.nantty.test/2.jpg"
        ])
    }

    func testThreadGalleryUsesOnlyReadyImagesInPostOrder() {
        let media = [
            ThreadPost.Media(id: "thread-image-1", type: "image", url: URL(string: "https://cdn.nantty.test/thread-1.jpg"), posterUrl: nil, status: "ready"),
            ThreadPost.Media(id: "thread-video", type: "video", url: URL(string: "https://cdn.nantty.test/thread.mp4"), posterUrl: nil, status: "ready"),
            ThreadPost.Media(id: "thread-pending", type: "image", url: URL(string: "https://cdn.nantty.test/pending.jpg"), posterUrl: nil, status: "processing"),
            ThreadPost.Media(id: "thread-image-2", type: "image", url: URL(string: "https://cdn.nantty.test/thread-2.jpg"), posterUrl: nil, status: "ready")
        ]

        let items = FeedImageGalleryItem.readyImages(from: media)

        XCTAssertEqual(items.map(\.id), ["thread-image-1", "thread-image-2"])
        XCTAssertEqual(items.map(\.url.absoluteString), [
            "https://cdn.nantty.test/thread-1.jpg",
            "https://cdn.nantty.test/thread-2.jpg"
        ])
    }

    func testGalleryNavigationIsBoundedAndDoesNotWrap() {
        XCTAssertEqual(FeedImageGalleryNavigation.boundedIndex(-1, count: 3), 0)
        XCTAssertEqual(FeedImageGalleryNavigation.boundedIndex(9, count: 3), 2)
        XCTAssertNil(FeedImageGalleryNavigation.boundedIndex(0, count: 0))

        XCTAssertEqual(FeedImageGalleryNavigation.previousIndex(from: 0, count: 3), 0)
        XCTAssertEqual(FeedImageGalleryNavigation.nextIndex(from: 0, count: 3), 1)
        XCTAssertEqual(FeedImageGalleryNavigation.previousIndex(from: 2, count: 3), 1)
        XCTAssertEqual(FeedImageGalleryNavigation.nextIndex(from: 2, count: 3), 2)
        XCTAssertNil(FeedImageGalleryNavigation.nextIndex(from: 0, count: 0))
    }

    func testAccessibleImageDescriptionIncludesContextAndGalleryPosition() {
        XCTAssertEqual(
            FeedImageGalleryNavigation.accessibilityLabel(context: "Image in post by @ada", index: 1, count: 3),
            "Image in post by @ada, image 2 of 3"
        )
        XCTAssertEqual(
            FeedImageGalleryNavigation.accessibilityLabel(context: "Post image", index: 10, count: 2),
            "Post image, image 2 of 2"
        )
        XCTAssertEqual(
            FeedImageGalleryNavigation.accessibilityLabel(context: "Post image", index: 0, count: 0),
            "Post image"
        )
    }
}
