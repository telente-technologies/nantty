import Foundation
import XCTest
@testable import Nantty

final class PostLinkTrackingTests: XCTestCase {
    func testOnlyWellFormedHTTPSURLsWithoutCredentialsAreAllowed() {
        XCTAssertEqual(PostTextLinks.safeHTTPSURL("https://example.com/article")?.absoluteString, "https://example.com/article")
        XCTAssertNil(PostTextLinks.safeHTTPSURL("http://example.com/article"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("javascript:alert(1)"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("https://user:secret@example.com/article"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("https://"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("https://example.com/a path"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("https://example.com/%ZZ"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL("https://example.com:99999/article"))
        XCTAssertNil(PostTextLinks.safeHTTPSURL(" https://example.com/article"))
    }

    func testPostTextMakesOnlySafeHTTPSDestinationsAccessibleAsLinks() {
        let text = "Read https://example.com/story. Ignore http://example.com and javascript:alert(1)."
        let attributed = PostTextLinks.attributedText(text)
        let linkedURLs = attributed.runs.compactMap(\.link)

        XCTAssertEqual(linkedURLs.map(\.absoluteString), ["https://example.com/story"])
        XCTAssertTrue(String(attributed.characters).contains("http://example.com"))
        XCTAssertTrue(String(attributed.characters).contains("javascript:alert(1)"))
    }

    func testLinkClickBatchMatchesReactNativeContractWithoutDestinationURL() throws {
        let payload = FeedInteractionBatch(events: [.postDetailLinkClick(postID: "post-123")])
        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let events = try XCTUnwrap(object["events"] as? [[String: String]])

        XCTAssertEqual(events, [["postId": "post-123", "kind": "link_click", "surface": "post_detail"]])
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("example.com"))
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("url"))
    }
}
