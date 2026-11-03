import Foundation
import XCTest
@testable import Nantty

final class SearchAPITests: XCTestCase {
    func testBuildsGlobalPostsSearchURLWithEncodedQueryAndOpaqueCursor() throws {
        let query = "  #food & makers?  "
        let cursor = "eyJvZmZzZXQiOjJ9+opaque&next"
        let url = try XCTUnwrap(SearchPostsService.url(baseURL: "https://api.nantty.com/v1", query: query, cursor: cursor))
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems

        XCTAssertEqual(url.path, "/v1/api/v1/search")
        XCTAssertEqual(items, [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "scope", value: "global"),
            URLQueryItem(name: "type", value: "posts"),
            URLQueryItem(name: "limit", value: "20"),
            URLQueryItem(name: "cursor", value: cursor)
        ])
    }

    func testServiceTrimsQueryAndSendsOptionalBearerTokenAndCursor() async throws {
        var capturedRequest: URLRequest?
        SearchStubURLProtocol.handler = { request in
            capturedRequest = request
            return (200, Data(searchPageJSON(id: "post-2", nextCursor: nil).utf8))
        }
        defer { SearchStubURLProtocol.handler = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SearchStubURLProtocol.self]
        let service = SearchPostsService(baseURL: "https://api.nantty.test", session: URLSession(configuration: configuration))

        let page = try await service.search(query: "  maker & market  ", cursor: "cursor+1", accessToken: "session-token")

        XCTAssertEqual(page.data.map(\.id), ["post-2"])
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(capturedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "q" })?.value, "maker & market")
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(capturedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "cursor" })?.value, "cursor+1")
    }

    func testRejectsEmptyOverlongQueryAndOversizedCursorBeforeNetwork() async {
        SearchStubURLProtocol.handler = { _ in XCTFail("Invalid search inputs must not reach the network"); return (500, Data()) }
        defer { SearchStubURLProtocol.handler = nil }
        let service = SearchPostsService(baseURL: "https://api.nantty.test")

        for (query, cursor) in [(" \n", nil), (String(repeating: "a", count: 101), nil), ("valid", String(repeating: "x", count: 301))] {
            do {
                _ = try await service.search(query: query, cursor: cursor)
                XCTFail("Expected invalid input to be rejected")
            } catch let error as SearchAPIError {
                XCTAssertEqual(error.localizedDescription, "Enter a search term of 1 to 100 characters.")
            } catch {
                XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testSafelyMapsOnlyPostResultsAndRejectsUnsafeIdentity() throws {
        let page = try JSONDecoder().decode(SearchPostsPage.self, from: Data(searchPageJSON(
            id: "post_1-safe", nextCursor: "next", thumbnailUrl: "javascript:alert(1)"
        ).utf8))
        XCTAssertEqual(page.data.first?.id, "post_1-safe")
        XCTAssertNil(page.data.first?.thumbnailUrl)

        let unsupported = Data(#"{"data":[{"type":"user","id":"user_1","authorId":"author_1"}],"nextCursor":null,"scope":"global"}"#.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(SearchPostsPage.self, from: unsupported))

        let unsafeID = Data(searchPageJSON(id: "../other", nextCursor: nil).utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(SearchPostsPage.self, from: unsafeID))
    }

    func testPaginationAppendsInOrderWithoutDuplicatePostIDs() throws {
        let first = try JSONDecoder().decode(SearchPostsPage.self, from: Data(searchPageJSON(id: "post-1", nextCursor: "next").utf8)).data[0]
        let duplicate = first
        let second = try JSONDecoder().decode(SearchPostsPage.self, from: Data(searchPageJSON(id: "post-2", nextCursor: nil).utf8)).data[0]

        XCTAssertEqual(SearchPostsPage.appending([duplicate, second], to: [first]).map(\.id), ["post-1", "post-2"])
    }

    func testSearchContentStatesCoverIdleLoadingErrorEmptyAndResults() {
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: true, isLoading: false, hasError: false, hasResults: false), .idle)
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: false, isLoading: true, hasError: false, hasResults: false), .loading)
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: false, isLoading: false, hasError: true, hasResults: false), .error)
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: false, isLoading: false, hasError: false, hasResults: false), .empty)
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: false, isLoading: false, hasError: false, hasResults: true), .results)
        XCTAssertEqual(SearchContentState.resolve(queryIsEmpty: false, isLoading: true, hasError: true, hasResults: true), .results)
    }

    private func searchPageJSON(id: String, nextCursor: String?, thumbnailUrl: String? = nil) -> String {
        let cursor = nextCursor.map { "\"\($0)\"" } ?? "null"
        let thumbnail = thumbnailUrl.map { "\"\($0)\"" } ?? "\"https://cdn.nantty.com/post.jpg\""
        return """
        {"data":[{"type":"post","id":"\(id)","authorId":"author_1","caption":"A searched post","thumbnailUrl":\(thumbnail),"likes":4,"views":9}],"nextCursor":\(cursor),"scope":"global"}
        """
    }
}

private final class SearchStubURLProtocol: URLProtocol {
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
