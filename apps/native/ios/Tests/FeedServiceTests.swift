import Foundation
import XCTest
@testable import Nantty

final class FeedServiceTests: XCTestCase {
    func testAuthenticatedFeedRequestSendsSessionAndDecodesViewerActions() async throws {
        var observedRequest: URLRequest?
        FeedStubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data(feedPageJSON(nextCursor: nil, liked: true, reposted: true).utf8))
        }
        defer { FeedStubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FeedStubURLProtocol.self]
        let service = FeedService(
            baseURL: "https://api.nantty.test",
            session: URLSession(configuration: configuration)
        )

        let page = try await service.fetch(feed: .forYou, cursor: nil, accessToken: "keychain-session")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/feeds/for-you")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer keychain-session")
        XCTAssertTrue(page.data[0].liked ?? false)
        XCTAssertTrue(page.data[0].reposted ?? false)
        XCTAssertTrue(page.data[0].bookmarked ?? false)
        XCTAssertEqual(page.data[0].author.id, "user_1")
    }

    func testFollowingRequestUsesAuthenticatedRouteCursorAndBearerToken() async throws {
        var observedRequest: URLRequest?
        FeedStubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data(feedPageJSON(nextCursor: nil).utf8))
        }
        defer { FeedStubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FeedStubURLProtocol.self]
        let service = FeedService(
            baseURL: "https://api.nantty.test",
            session: URLSession(configuration: configuration)
        )
        let cursor = "opaque-cursor/with+symbols"

        _ = try await service.fetch(feed: .following, cursor: cursor, accessToken: "keychain-session")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/feeds/following")
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(observedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "cursor", value: cursor)])
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer keychain-session")
    }

    func testFollowingRequestRejectsMissingTokenWithoutNetworkRequest() async {
        FeedStubURLProtocol.handler = { _ in XCTFail("Following must not issue a request without a token"); return (500, Data()) }
        defer { FeedStubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FeedStubURLProtocol.self]
        let service = FeedService(
            baseURL: "https://api.nantty.test",
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await service.fetch(feed: .following, cursor: nil, accessToken: nil)
            XCTFail("Expected signed-in token requirement")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view posts from people you follow.")
        }
    }

    func testBuildsFirstPageURLWithoutCursor() throws {
        let url = try FeedService.url(baseURL: "https://api.nantty.com/v1", feed: .forYou, cursor: nil)

        XCTAssertEqual(url.path, "/v1/api/v1/feeds/for-you")
        XCTAssertNil(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
    }

    func testBuildsNextPageURLWithOpaqueCursor() throws {
        let cursor = "eyJwYWdlIjoyfQ+opaque&value"
        let url = try FeedService.url(baseURL: "https://api.nantty.com", feed: .forYou, cursor: cursor)
        let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems

        XCTAssertEqual(queryItems, [URLQueryItem(name: "cursor", value: cursor)])
    }

    func testBuildsFollowingFeedRoute() throws {
        let url = try FeedService.url(baseURL: "https://api.nantty.com", feed: .following, cursor: "next")

        XCTAssertEqual(url.path, "/api/v1/feeds/following")
        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "cursor", value: "next")])
    }

    func testDecodesPageAndEndCursor() throws {
        let page = try JSONDecoder().decode(FeedPage.self, from: Data(feedPageJSON(nextCursor: "next-page").utf8))

        XCTAssertEqual(page.data.map(\.id), ["post-1"])
        XCTAssertEqual(page.nextCursor, "next-page")

        let finalPage = try JSONDecoder().decode(FeedPage.self, from: Data(feedPageJSON(nextCursor: nil).utf8))
        XCTAssertNil(finalPage.nextCursor)
    }

    func testAppendingPagesPreservesOrderAndRemovesDuplicatePosts() throws {
        let first = try JSONDecoder().decode(FeedPage.self, from: Data(feedPageJSON(nextCursor: "next").utf8)).data[0]
        let duplicate = first
        let second = try JSONDecoder().decode(FeedPage.self, from: Data(feedPageJSON(id: "post-2", nextCursor: nil).utf8)).data[0]

        XCTAssertEqual(FeedPage.appending([duplicate, second], to: [first]).map(\.id), ["post-1", "post-2"])
    }

    func testRejectsInvalidBackendURL() {
        XCTAssertThrowsError(try FeedService.url(baseURL: "https://user:secret@example.com", cursor: nil))
    }

    private func feedPageJSON(id: String = "post-1", nextCursor: String?, liked: Bool = false, reposted: Bool = false) -> String {
        let cursorJSON = nextCursor.map { "\"\($0)\"" } ?? "null"
        return """
        {
          "data": [{
            "id": "\(id)",
            "author": {"id":"user_1","name":"Ada","username":"ada","avatarUrl":null,"verified":false},
            "postedAs": null,
            "createdAt": "2026-11-02T10:00:00Z",
            "text": "Feed item",
            "media": [],
            "likes": 2,
            "liked": \(liked),
            "bookmarked": true,
            "comments": 1,
            "reposts": 0,
            "reposted": \(reposted),
            "shares": 0
          }],
          "nextCursor": \(cursorJSON)
        }
        """
    }
}

private final class FeedStubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Int, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler, let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let result = handler(request)
        guard let response = HTTPURLResponse(url: url, statusCode: result.0, httpVersion: nil, headerFields: nil) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: result.1)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
