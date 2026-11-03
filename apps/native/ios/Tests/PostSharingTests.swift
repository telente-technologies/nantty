import Foundation
import XCTest
@testable import Nantty

final class PostSharingTests: XCTestCase {
    func testBuildsReactNativeCompatibleShareMessageAndEscapesPostID() {
        let message = PostShareMessage.make(
            authorName: "Ada Lovelace",
            postID: "post/with space",
            webBaseURL: "https://web.nantty.com"
        )

        XCTAssertEqual(message, "Ada Lovelace on Nantty: https://web.nantty.com/post/post%2Fwith%20space")
    }

    func testRejectsInsecureRemoteShareOrigin() {
        XCTAssertNil(PostShareMessage.make(authorName: "Ada", postID: "post-1", webBaseURL: "http://web.nantty.com"))
    }

    func testOnlyCompletedShareCallsRecordingClosure() {
        var records = 0

        PostShareCompletion.recordIfCompleted(false) { records += 1 }
        XCTAssertEqual(records, 0)

        PostShareCompletion.recordIfCompleted(true) { records += 1 }
        XCTAssertEqual(records, 1)
    }

    func testShareEndpointUsesLinkChannelAndOptionalBearerToken() async throws {
        var observedRequest: URLRequest?
        ShareStubURLProtocol.handler = { request in
            observedRequest = request
            return (204, Data())
        }
        defer { ShareStubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ShareStubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        try await api.recordPostShare(postID: "post-1", accessToken: "synthetic-token")

        XCTAssertEqual(observedRequest?.httpMethod, "POST")
        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/posts/post-1/share")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer synthetic-token")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let body = try XCTUnwrap(observedRequest?.httpBody)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(json, ["channel": "link"])
    }

    func testShareEndpointAllowsAnonymousCompletedShare() async throws {
        var observedRequest: URLRequest?
        ShareStubURLProtocol.handler = { request in
            observedRequest = request
            return (204, Data())
        }
        defer { ShareStubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ShareStubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        try await api.recordPostShare(postID: "post-1", accessToken: nil)

        XCTAssertNil(observedRequest?.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/posts/post-1/share")
    }
}

private final class ShareStubURLProtocol: URLProtocol {
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
