import XCTest
@testable import Nantty

final class PostThreadAPITests: XCTestCase {
    func testThreadPlatformIdentityIsNanttyForIPhone() {
        XCTAssertEqual(PostThreadView.platformIdentityLabel, "Nantty for iPhone")
    }

    func testThreadCompletionScopeRejectsPreviousPostAndAccount() {
        let scope = PostThreadRequestScope(postID: "post-1", accountID: "user-1")

        XCTAssertTrue(scope.matches(postID: "post-1", accountID: "user-1"))
        XCTAssertFalse(scope.matches(postID: "post-2", accountID: "user-1"))
        XCTAssertFalse(scope.matches(postID: "post-1", accountID: "user-2"))
        XCTAssertFalse(scope.matches(postID: "post-1", accountID: nil))
    }

    func testDecodesActualThreadPageWithNestedReplies() throws {
        let json = Data("""
        {
          "data": [{
            "id": "comment-1", "postId": "post-1", "parentCommentId": null,
            "author": {"id":"user-1","name":"Ada","username":"ada","avatarUrl":null,"verified":true,"isCreator":false},
            "text": "Top-level reply", "createdAt": "2026-11-02T10:00:00.000Z",
            "media": [
              {"id":"image-1","type":"image","url":"https://cdn.nantty.com/reply.jpg","posterUrl":null,"status":"ready"},
              {"id":"video-1","type":"video","url":"https://cdn.nantty.com/reply.mp4","posterUrl":"https://cdn.nantty.com/reply-poster.jpg","status":"ready"},
              {"id":"pending-1","type":"image","url":"https://cdn.nantty.com/pending.jpg","posterUrl":null,"status":"processing"}
            ],
            "videoReplies": [
              {"clipId":"clip-ready","thumbnailUrl":"https://cdn.nantty.com/clip-ready.jpg","createdAt":"2026-11-02T10:02:00.000Z"},
              {"clipId":"clip-no-thumbnail","thumbnailUrl":null,"createdAt":"2026-11-02T10:03:00.000Z"},
              {"clipId":"clip-insecure","thumbnailUrl":"http://cdn.nantty.com/clip-insecure.jpg","createdAt":"2026-11-02T10:04:00.000Z"}
            ],
            "inlineReplies": [{
              "id": "comment-2", "postId": "post-1", "parentCommentId": "comment-1",
              "author": {"id":"user-2","name":"Bola","username":"bola","avatarUrl":null,"verified":false,"isCreator":false},
              "text": "Nested reply", "createdAt": "2026-11-02T10:01:00.000Z", "inlineReplies": []
            }]
          }], "nextCursor": null
        }
        """.utf8)

        let page = try SessionPayloadDecoder.decode(ThreadCommentPage.self, from: json)

        XCTAssertEqual(page.data.count, 1)
        XCTAssertEqual(page.data[0].text, "Top-level reply")
        XCTAssertEqual(page.data[0].media.compactMap(\.previewURL).count, 2)
        XCTAssertEqual(page.data[0].media.compactMap(\.previewURL).last?.lastPathComponent, "reply-poster.jpg")
        XCTAssertEqual(page.data[0].videoReplies.count, 3)
        XCTAssertEqual(page.data[0].videoReplies.first?.clipId, "clip-ready")
        XCTAssertEqual(page.data[0].videoReplies.first?.previewURL?.lastPathComponent, "clip-ready.jpg")
        XCTAssertNil(page.data[0].videoReplies.last?.previewURL)
        XCTAssertNil(page.data[0].videoReplies[2].previewURL)
        XCTAssertEqual(page.data[0].videoReplies.compactMap(\.previewURL).count, 1)
        XCTAssertEqual(page.data[0].inlineReplies.first?.text, "Nested reply")
    }

    func testDecodesPostAndOnlyReadyImageMedia() throws {
        let json = Data("""
        {"id":"post-1","author":{"id":"user-1","name":"Ada","username":"ada","avatarUrl":null,"verified":false,"isCreator":false},"createdAt":"2026-11-02T10:00:00Z","text":"A real post","media":[{"id":"image-1","type":"image","url":"https://cdn.nantty.com/image.jpg","posterUrl":null,"status":"ready","blurhash":null},{"id":"image-2","type":"image","url":"https://cdn.nantty.com/pending.jpg","posterUrl":null,"status":"processing","blurhash":null}],"likes":12,"liked":true,"bookmarked":true,"reposts":4,"reposted":false}
        """.utf8)

        let post = try SessionPayloadDecoder.decode(ThreadPost.self, from: json)

        XCTAssertEqual(post.text, "A real post")
        XCTAssertEqual(post.media.compactMap(\.readyImageURL).count, 1)
        XCTAssertEqual(post.media.first?.readyImageURL?.host, "cdn.nantty.com")
        XCTAssertEqual(post.likes, 12)
        XCTAssertTrue(post.liked)
        XCTAssertTrue(post.bookmarked ?? false)
        XCTAssertEqual(post.reposts, 4)
        XCTAssertFalse(post.reposted)
    }

    func testBuildsRelevantThreadURLAndEscapesPostPathSegment() throws {
        let url = try XCTUnwrap(PostThreadService.url(
            baseURL: "https://api.nantty.com/v1",
            path: PostThreadService.threadPath(postID: "post-1")
        ))

        XCTAssertEqual(url.path, "/v1/api/v1/posts/post-1/thread")
        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, [URLQueryItem(name: "sort", value: "relevant")])
        XCTAssertEqual(PostThreadService.threadPath(postID: "abc/def"), "/api/v1/posts/abc%2Fdef/thread?sort=relevant")
        XCTAssertEqual(PostThreadService.pathSegment("abc/def"), "abc%2Fdef")
    }

    func testThreadURLEncodesCursorWithoutChangingSort() throws {
        let url = try XCTUnwrap(PostThreadService.url(
            baseURL: "https://api.nantty.com",
            path: PostThreadService.threadPath(postID: "post-1", cursor: "next/page + token")
        ))

        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, [
            URLQueryItem(name: "sort", value: "relevant"),
            URLQueryItem(name: "cursor", value: "next/page + token")
        ])
    }

    func testThreadPageDeduplicatesRootCommentsAndStopsRepeatedCursor() {
        let first = makeComment(id: "comment-1", text: "First")
        let duplicate = makeComment(id: "comment-1", text: "Stale duplicate")
        let second = makeComment(id: "comment-2", text: "Second")
        let merged = ThreadCommentPage.appending([duplicate, second], to: [first])
        let repeated = ThreadCommentPage(data: [second], nextCursor: "cursor-2")
            .continuing(after: "cursor-2", consumedCursors: ["cursor-2"])
        let blankCursor = ThreadCommentPage(data: [second], nextCursor: " \n")
            .continuing(after: "cursor-1", consumedCursors: ["cursor-1"])

        XCTAssertEqual(merged.map(\.id), ["comment-1", "comment-2"])
        XCTAssertEqual(merged.first?.text, "First")
        XCTAssertNil(repeated.nextCursor)
        XCTAssertNil(blankCursor.nextCursor)
    }

    private func makeComment(id: String, text: String) -> ThreadComment {
        ThreadComment(
            id: id,
            postId: "post-1",
            parentCommentId: nil,
            author: .init(name: "Ada", username: "ada", avatarUrl: nil, verified: false),
            text: text,
            createdAt: "2026-11-02T10:00:00Z"
        )
    }

    func testCreateCommentBodyOmitsParentForTopLevelReplyAndIncludesParentForNestedReply() throws {
        let encoder = JSONEncoder()
        let topLevel = try JSONSerialization.jsonObject(with: encoder.encode(CreateThreadCommentRequest(text: "Hello", parentCommentId: nil))) as? [String: String]
        let nested = try JSONSerialization.jsonObject(with: encoder.encode(CreateThreadCommentRequest(text: "Reply", parentCommentId: "comment-1"))) as? [String: String]
        let managedNested = try JSONSerialization.jsonObject(with: encoder.encode(CreateThreadCommentRequest(text: "Reply", parentCommentId: "comment-1", asProfileId: "store-1"))) as? [String: String]

        XCTAssertEqual(topLevel, ["text": "Hello"])
        XCTAssertEqual(nested, ["text": "Reply", "parentCommentId": "comment-1"])
        XCTAssertEqual(managedNested, ["text": "Reply", "parentCommentId": "comment-1", "asProfileId": "store-1"])
    }
}
