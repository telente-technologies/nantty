import Foundation
import XCTest
@testable import Nantty

final class PublicProfileAPITests: XCTestCase {
    func testUsesReactNativeProfileAndPublicPostsRoutes() throws {
        let profileURL = try XCTUnwrap(PublicProfileAPI.url(baseURL: "https://api.nantty.test/v1", path: "/api/v1/users/user_1"))
        let postsURL = try XCTUnwrap(PublicProfileAPI.url(
            baseURL: "https://api.nantty.test/v1",
            path: "/api/v1/users/user_1/posts",
            queryItems: [URLQueryItem(name: "visibility", value: "public"), URLQueryItem(name: "cursor", value: "opaque+cursor&next")]
        ))

        XCTAssertEqual(profileURL.path, "/v1/api/v1/users/user_1")
        XCTAssertEqual(postsURL.path, "/v1/api/v1/users/user_1/posts")
        XCTAssertEqual(URLComponents(url: postsURL, resolvingAgainstBaseURL: false)?.queryItems, [
            URLQueryItem(name: "visibility", value: "public"),
            URLQueryItem(name: "cursor", value: "opaque+cursor&next")
        ])
    }

    func testProfileAndPostsSendOptionalBearerAndPublicVisibility() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("/posts") == true {
                return (200, Data(#"{"data":[{"id":"post_1","text":"Public post","media":[]}],"nextCursor":null}"#.utf8))
            }
            return (200, Data(profileJSON(isPrivate: false).utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let service = PublicProfileAPI(baseURL: "https://api.nantty.test", session: stubSession())

        let profile = try await service.fetchProfile(userID: "user_1", accessToken: "access-token")
        let page = try await service.fetchPublicPosts(userID: profile.id, cursor: nil, accessToken: nil)

        XCTAssertEqual(profile.name, "Ada")
        XCTAssertEqual(page.data.map(\.id), ["post_1"])
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/users/user_1", "/api/v1/users/user_1/posts"])
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer access-token")
        XCTAssertNil(requests[1].value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(requests[1].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "visibility", value: "public")])
    }

    func testFollowStatusUsesAuthenticatedEndpoint() async throws {
        var observed: URLRequest?
        PublicProfileStubURLProtocol.handler = { request in
            observed = request
            return (200, Data(#"{"state":"accepted","followedBy":false,"followersCount":2,"followingCount":3,"viewerPostNotifications":"off"}"#.utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let service = PublicProfileAPI(baseURL: "https://api.nantty.test", session: stubSession())

        let result = try await service.fetchFollowStatus(userID: "user_1", accessToken: "private-token")

        XCTAssertEqual(observed?.url?.path, "/api/v1/users/user_1/follow-status")
        XCTAssertEqual(observed?.value(forHTTPHeaderField: "Authorization"), "Bearer private-token")
        XCTAssertEqual(result.state, "accepted")
    }

    func testFollowAndUnfollowUseAuthenticatedReactNativeRoutes() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.httpMethod == "POST" {
                return (200, Data(#"{"state":"requested"}"#.utf8))
            }
            return (204, Data())
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let service = PublicProfileAPI(baseURL: "https://api.nantty.test", session: stubSession())

        let requested = try await service.setFollow(userID: "user_1", shouldFollow: true, accessToken: "session-token")
        let removed = try await service.setFollow(userID: "user_1", shouldFollow: false, accessToken: "session-token")

        XCTAssertEqual(requested.state, "requested")
        XCTAssertEqual(removed.state, "none")
        XCTAssertEqual(requests.map(\.httpMethod), ["POST", "DELETE"])
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/users/user_1/follow", "/api/v1/users/user_1/follow"])
        XCTAssertEqual(requests.map { $0.value(forHTTPHeaderField: "Authorization") }, ["Bearer session-token", "Bearer session-token"])
        XCTAssertEqual(requests[0].httpBody, Data("{}".utf8))
        XCTAssertNil(requests[1].httpBody)
    }

    func testRejectsUnsafeUserIDsBeforeAnyRequest() async {
        PublicProfileStubURLProtocol.handler = { _ in
            XCTFail("Unsafe IDs must not reach the network")
            return (500, Data())
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let service = PublicProfileAPI(baseURL: "https://api.nantty.test", session: stubSession())

        do {
            _ = try await service.fetchProfile(userID: "../private", accessToken: nil)
            XCTFail("Expected invalid profile ID")
        } catch let error as PublicProfileAPIError {
            XCTAssertEqual(error.localizedDescription, "This profile is unavailable.")
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testPrivateProfileDoesNotRequestOrExposePostsForGuest() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            return (200, Data(profileJSON(isPrivate: true, isFollowing: true, followState: "accepted").utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let repository = PublicProfileRepository(
            baseURL: "https://api.nantty.test",
            session: stubSession(),
            credentials: TestProfileCredentials(tokens: nil)
        )

        let result = try await repository.load(userID: "user_1", isSignedIn: false)

        XCTAssertEqual(result.visibility, .privateProfile)
        XCTAssertNil(result.page)
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/users/user_1"])
        XCTAssertNil(requests[0].value(forHTTPHeaderField: "Authorization"))
    }

    func testPrivateOwnProfileRemainsVisibleToItsOwner() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("/follow-status") == true {
                return (200, Data(#"{"state":"none"}"#.utf8))
            }
            if request.url?.path.hasSuffix("/posts") == true {
                return (200, Data(#"{"data":[],"nextCursor":null}"#.utf8))
            }
            return (200, Data(profileJSON(isPrivate: true).utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let credentials = TestProfileCredentials(tokens: SessionTokens(accessToken: "access", refreshToken: "refresh"))
        let repository = PublicProfileRepository(baseURL: "https://api.nantty.test", session: stubSession(), credentials: credentials)

        let result = try await repository.load(userID: "user_1", isSignedIn: true, viewerID: "user_1")

        XCTAssertEqual(result.visibility, .open)
        XCTAssertEqual(requests.map { $0.url?.path }, [
            "/api/v1/users/user_1",
            "/api/v1/users/user_1/follow-status",
            "/api/v1/users/user_1/posts",
        ])
    }

    func testPrivateProfileRequiresAcceptedFollowBeforeLoadingPosts() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("follow-status") == true {
                return (200, Data(#"{"state":"requested"}"#.utf8))
            }
            return (200, Data(profileJSON(isPrivate: true).utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let credentials = TestProfileCredentials(tokens: SessionTokens(accessToken: "access", refreshToken: "refresh"))
        let repository = PublicProfileRepository(baseURL: "https://api.nantty.test", session: stubSession(), credentials: credentials)

        let result = try await repository.load(userID: "user_1", isSignedIn: true)

        XCTAssertEqual(result.visibility, .privateProfile)
        XCTAssertNil(result.page)
        XCTAssertEqual(requests.map { $0.url?.path }, [
            "/api/v1/users/user_1",
            "/api/v1/users/user_1/follow-status"
        ])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer access" })
    }

    func testPrivateProfileLoadsOnlyPublicPostsAfterAcceptedFollow() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("follow-status") == true {
                return (200, Data(#"{"state":"accepted"}"#.utf8))
            }
            if request.url?.path.hasSuffix("/posts") == true {
                return (200, Data(#"{"data":[{"id":"post_1","text":"Approved public post","media":[]}],"nextCursor":null}"#.utf8))
            }
            return (200, Data(profileJSON(isPrivate: true).utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let credentials = TestProfileCredentials(tokens: SessionTokens(accessToken: "access", refreshToken: "refresh"))
        let repository = PublicProfileRepository(baseURL: "https://api.nantty.test", session: stubSession(), credentials: credentials)

        let result = try await repository.load(userID: "user_1", isSignedIn: true)

        XCTAssertEqual(result.visibility, .open)
        XCTAssertEqual(result.page?.data.map(\.id), ["post_1"])
        XCTAssertEqual(requests.map { $0.url?.path }, [
            "/api/v1/users/user_1",
            "/api/v1/users/user_1/follow-status",
            "/api/v1/users/user_1/posts"
        ])
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(requests[2].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "visibility", value: "public")])
    }

    func testBlockedAndSuspendedProfilesNeverLoadPosts() async throws {
        XCTAssertEqual(try visibility(isPrivate: false, followState: "blocked"), .blocked)
        let suspended = try JSONDecoder().decode(PublicProfile.self, from: Data(profileJSON(isPrivate: false, status: "suspended").utf8))
        XCTAssertEqual(PublicProfileVisibility.resolve(profile: suspended, followState: "accepted"), .suspended)
        XCTAssertEqual(try visibility(isPrivate: true, followState: "rejected"), .privateProfile)
        XCTAssertEqual(try visibility(isPrivate: false, followState: nil), .open)
    }

    func testMissingPrivacyFieldFailsClosed() throws {
        let profile = try JSONDecoder().decode(PublicProfile.self, from: Data(#"{"id":"user_1","name":"Ada","username":"ada"}"#.utf8))

        XCTAssertEqual(profile.isPrivate, nil)
        XCTAssertEqual(PublicProfileVisibility.resolve(profile: profile, followState: "none"), .privateProfile)
    }

    func testFailedFollowStatusCannotUnlockPrivatePostsFromProfileFallback() async throws {
        var requests: [URLRequest] = []
        PublicProfileStubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("follow-status") == true { return (503, Data()) }
            return (200, Data(profileJSON(isPrivate: true, isFollowing: true, followState: "accepted").utf8))
        }
        defer { PublicProfileStubURLProtocol.handler = nil }
        let credentials = TestProfileCredentials(tokens: SessionTokens(accessToken: "access", refreshToken: "refresh"))
        let repository = PublicProfileRepository(baseURL: "https://api.nantty.test", session: stubSession(), credentials: credentials)

        let result = try await repository.load(userID: "user_1", isSignedIn: true)

        XCTAssertEqual(result.visibility, .privateProfile)
        XCTAssertNil(result.page)
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/users/user_1", "/api/v1/users/user_1/follow-status"])
    }

    func testPostPaginationDeduplicatesWithoutReordering() throws {
        let first = try JSONDecoder().decode(PublicProfilePostsPage.self, from: Data(#"{"data":[{"id":"post_1","text":"One","media":[]}],"nextCursor":"next"}"#.utf8)).data[0]
        let duplicate = first
        let second = try JSONDecoder().decode(PublicProfilePostsPage.self, from: Data(#"{"data":[{"id":"post_2","text":"Two","media":[]}],"nextCursor":null}"#.utf8)).data[0]

        XCTAssertEqual(PublicProfilePostsPage.appending([duplicate, second], to: [first]).map(\.id), ["post_1", "post_2"])
    }

    private func visibility(isPrivate: Bool, followState: String?) throws -> PublicProfileVisibility {
        let profile = try JSONDecoder().decode(PublicProfile.self, from: Data(profileJSON(isPrivate: isPrivate).utf8))
        return PublicProfileVisibility.resolve(profile: profile, followState: followState)
    }

    private func profileJSON(isPrivate: Bool, status: String = "active", isFollowing: Bool = false, followState: String = "none") -> String {
        """
        {"data":{"id":"user_1","name":"Ada","username":"ada","bio":"Maker","avatarUrl":"https://cdn.nantty.test/avatar.jpg","bannerUrl":null,"verified":false,"followers":14,"following":9,"posts":3,"joinedAt":"2026-01-02T00:00:00Z","isPrivate":\(isPrivate),"isFollowing":\(isFollowing),"followState":"\(followState)","account":{"status":"\(status)"}}}
        """
    }

    private func stubSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [PublicProfileStubURLProtocol.self]
        return URLSession(configuration: configuration)
    }
}

private final class TestProfileCredentials: SessionCredentialStoring {
    var tokens: SessionTokens?

    init(tokens: SessionTokens?) { self.tokens = tokens }
    func load() throws -> SessionTokens? { tokens }
    func save(_ tokens: SessionTokens) throws { self.tokens = tokens }
    func clear() throws { tokens = nil }
}

private final class PublicProfileStubURLProtocol: URLProtocol {
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
