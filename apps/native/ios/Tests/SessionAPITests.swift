import Foundation
import XCTest
@testable import Nantty

final class SessionAPITests: XCTestCase {
    func testManagedCommentProfilesUseAuthenticatedExistingEndpointAndFilterUnsafeProfiles() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"data":[
              {"id":"biz-1","kind":"business","type":"business","name":"Ada Goods","handle":"adagoods","onHold":false},
              {"id":"brand-1","kind":"brand","name":"Ada Brand","handle":"adabrand"},
              {"id":"store-held","kind":"store","name":"Held Store","handle":"held","onHold":true},
              {"id":"personal","kind":"person","name":"Ada","handle":"ada"},
              {"id":"government","kind":"government","name":"Agency","handle":"agency"}
            ],"nextCursor":null}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let page = try await api.fetchCommentProfiles(accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/users/me/profiles")
        XCTAssertEqual(observedRequest?.httpMethod, "GET")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(page.data.filter(\.isEligibleForCommenting).map(\.id), ["biz-1", "brand-1"])
    }

    func testMalformedManagedCommentProfileFailsClosed() throws {
        let missingKind = Data(#"{"data":[{"id":"profile-1","name":"Store","handle":"store"}]}"#.utf8)
        XCTAssertThrowsError(try SessionPayloadDecoder.decode(ManagedCommentProfilesPage.self, from: missingKind))
        let malformedHold = Data(#"{"data":[{"id":"profile-1","kind":"store","name":"Store","handle":"store","onHold":"false"}]}"#.utf8)
        XCTAssertThrowsError(try SessionPayloadDecoder.decode(ManagedCommentProfilesPage.self, from: malformedHold))
    }

    func testCommentRequestUsesExistingPathAndSendsManagedIdentityAndParent() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (201, Data("""
            {"id":"comment-1","postId":"post-1","parentCommentId":"parent-1","author":{"name":"Ada Goods","username":"adagoods","avatarUrl":null,"verified":false},"text":"Reply","createdAt":"2026-11-02T10:00:00Z"}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        _ = try await api.createComment(postID: "post-1", text: "Reply", parentCommentID: "parent-1", asProfileID: "business-1", accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/posts/post-1/comments")
        XCTAssertEqual(observedRequest?.httpMethod, "POST")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        let body = try XCTUnwrap(observedRequest?.httpBody)
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(payload, ["text": "Reply", "parentCommentId": "parent-1", "asProfileId": "business-1"])
    }

    func testFeedLinkClickUsesAuthenticatedBatchContractWithoutDestinationURL() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (204, Data())
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        try await api.recordFeedInteraction(.postDetailLinkClick(postID: "post-1"), accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/feeds/interactions/batch")
        XCTAssertEqual(observedRequest?.httpMethod, "POST")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        let body = try XCTUnwrap(observedRequest?.httpBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let events = try XCTUnwrap(object["events"] as? [[String: String]])
        XCTAssertEqual(events, [["postId": "post-1", "kind": "link_click", "surface": "post_detail"]])
        XCTAssertFalse(String(decoding: body, as: UTF8.self).contains("destination"))
    }

    func testAuthenticatedPostReadParsesViewerInteractionFlags() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"id":"post-1","author":{"name":"Ada","username":"ada","avatarUrl":null,"verified":false},"createdAt":"2026-11-02T10:00:00Z","text":"Hello","media":[],"likes":3,"liked":true,"reposts":2,"reposted":true}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let post = try await api.fetchPost(postID: "post-1", accessToken: "session-token")

        XCTAssertTrue(post.liked)
        XCTAssertTrue(post.reposted)
        XCTAssertEqual(post.likes, 3)
        XCTAssertEqual(post.reposts, 2)
        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/posts/post-1")
        XCTAssertEqual(observedRequest?.httpMethod, "GET")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
    }

    func testLikeAndRepostUseExistingAuthenticatedRoutesAndBodies() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            if request.url?.path.hasSuffix("/repost") == true, request.httpMethod == "POST" {
                return (201, Data("{\"id\":\"repost-1\"}".utf8))
            }
            return (204, Data())
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        try await api.setPostLiked(postID: "post-one", liked: true, accessToken: "session-token")
        try await api.setPostLiked(postID: "post-one", liked: false, accessToken: "session-token")
        try await api.setPostReposted(postID: "post-one", reposted: true, accessToken: "session-token")
        try await api.setPostReposted(postID: "post-one", reposted: false, accessToken: "session-token")

        XCTAssertEqual(requests.map(\.httpMethod), ["POST", "DELETE", "POST", "DELETE"])
        XCTAssertEqual(requests.map { $0.url?.percentEncodedPath }, [
            "/api/v1/posts/post-one/like",
            "/api/v1/posts/post-one/like",
            "/api/v1/posts/post-one/repost",
            "/api/v1/posts/post-one/repost",
        ])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer session-token" })
        XCTAssertNil(requests[0].httpBody)
        XCTAssertNil(requests[1].httpBody)
        let repostBody = try XCTUnwrap(requests[2].httpBody)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: repostBody) as? [String: String], [:], "Repost uses the API's empty JSON object body")
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertNil(requests[3].httpBody)
    }

    func testLikeAndRepostFailuresAreReturnedInsteadOfReportedAsSuccess() async throws {
        StubURLProtocol.handler = { _ in (503, Data("{\"message\":\"Temporarily unavailable\"}".utf8)) }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        do {
            try await api.setPostLiked(postID: "post-one", liked: true, accessToken: "session-token")
            XCTFail("A failed Like response must not be treated as successful")
        } catch let error as SessionAPIError {
            XCTAssertEqual(error.statusCode, 503)
        }

        do {
            try await api.setPostReposted(postID: "post-one", reposted: true, accessToken: "session-token")
            XCTFail("A failed Repost response must not be treated as successful")
        } catch let error as SessionAPIError {
            XCTAssertEqual(error.statusCode, 503)
        }
    }

    func testSaveAndUnsaveUseAuthenticatedSavesContract() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            return (204, Data())
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        try await api.setPostSaved(postID: "post /1", saved: true, accessToken: "keychain-session")
        try await api.setPostSaved(postID: "post /1", saved: false, accessToken: "keychain-session")

        XCTAssertEqual(requests.map(\.httpMethod), ["POST", "DELETE"])
        XCTAssertEqual(requests.map { $0.url?.percentEncodedPath }, ["/api/v1/saves", "/api/v1/saves"])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer keychain-session" })
        let body = try XCTUnwrap(requests[0].httpBody)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: body) as? [String: String], ["type": "post", "targetId": "post /1"])
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(requests[1].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "type", value: "post"), URLQueryItem(name: "targetId", value: "post /1")])
    }

    func testSavedPostsUsesAuthenticatedPostFilterAndOptionalCursor() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            return (200, Data("""
            {"data":[{"id":"save-1","type":"post","targetId":"post-1","savedAt":"2026-11-02T10:00:00Z","preview":{"title":"A saved post","thumbnailUrl":"https://cdn.nantty.test/post.jpg","href":"/post/post-1","author":"ada","price":null,"durationSeconds":null}}],"nextCursor":"save-cursor"}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let firstPage = try await api.fetchSavedPosts(cursor: nil, accessToken: "keychain-session")
        let nextPage = try await api.fetchSavedPosts(cursor: firstPage.nextCursor, accessToken: "keychain-session")

        XCTAssertEqual(firstPage.data.map(\.targetId), ["post-1"])
        XCTAssertEqual(firstPage.data.first?.preview.thumbnailUrl?.absoluteString, "https://cdn.nantty.test/post.jpg")
        XCTAssertEqual(firstPage.nextCursor, "save-cursor")
        XCTAssertEqual(nextPage.data.first?.preview.title, "A saved post")
        XCTAssertEqual(requests.map(\.httpMethod), ["GET", "GET"])
        XCTAssertTrue(requests.allSatisfy { $0.url?.path == "/api/v1/saves" })
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer keychain-session" })
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(requests[0].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "type", value: "post")])
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(requests[1].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "type", value: "post"), URLQueryItem(name: "cursor", value: "save-cursor")])
    }

    func testSavedPostsRejectsFailedResponse() async throws {
        StubURLProtocol.handler = { _ in (503, Data("{\"message\":\"Temporarily unavailable\"}".utf8)) }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })

        do {
            _ = try await api.fetchSavedPosts(cursor: nil, accessToken: "keychain-session")
            XCTFail("A failed saved-posts response must not be treated as success")
        } catch let error as SessionAPIError {
            XCTAssertEqual(error.statusCode, 503)
        }
    }

    func testSaveFailureIsReturnedInsteadOfReportedAsSuccess() async throws {
        StubURLProtocol.handler = { _ in (503, Data("{\"message\":\"Temporarily unavailable\"}".utf8)) }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        do {
            try await api.setPostSaved(postID: "post-one", saved: true, accessToken: "keychain-session")
            XCTFail("A failed Save response must not be treated as successful")
        } catch let error as SessionAPIError {
            XCTAssertEqual(error.statusCode, 503)
        }
    }

    func testTextPostUsesAuthenticatedIdempotentPostsContract() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (201, Data("{\"id\":\"post-created\"}".utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let postID = try await api.createTextPost(text: "Hello", accessToken: "session-token", idempotencyKey: "attempt-123")

        XCTAssertEqual(postID, "post-created")
        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/posts")
        XCTAssertEqual(observedRequest?.httpMethod, "POST")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Idempotency-Key"), "attempt-123")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let body = try XCTUnwrap(observedRequest?.httpBody)
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(payload, ["text": "Hello", "kind": "post"])
    }

    func testWalletOverviewUsesAuthenticatedSelfEndpointWithoutUserIdentifier() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"available":{"amountMinor":125050,"currency":"NGN"},"pending":{"amountMinor":9000,"currency":"NGN"},"locked":{"amountMinor":0,"currency":"NGN"},"inEscrow":{"amountMinor":9000,"currency":"NGN"},"payoutRequested":{"amountMinor":0,"currency":"NGN"},"negativeBalance":{"amountMinor":0,"currency":"NGN"},"nextAvailableAt":null,"adCredit":{"amountMinor":1500,"currency":"NGN"},"earningsPayable":{"amountMinor":3000,"currency":"NGN"},"debts":{"amountMinor":0,"currency":"NGN"},"coins":{"spendable":42,"earned":8},"lines":[{"key":"available","label":"Available to withdraw","description":"Ready","amount":{"amountMinor":125050,"currency":"NGN"}},{"key":"coins","label":"Coins","description":"Gift coins","amount":{"amountMinor":50,"currency":"COIN"}}],"verification":{"level":1,"withdrawalsUnlocked":false,"waitingForVerification":{"amountMinor":128050,"currency":"NGN"},"nextStep":"identity_check","message":"Verify to withdraw ₦1,280.50"}}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let wallet = try await api.fetchWalletSummary(accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/wallets/me")
        XCTAssertNil(observedRequest?.url?.query)
        XCTAssertEqual(observedRequest?.httpMethod, "GET")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(wallet.available.amountMinor, 125_050)
        XCTAssertEqual(wallet.lines?.count, 2)
        XCTAssertEqual(wallet.coins, WalletCoinHoldings(spendable: 42, earned: 8))
        XCTAssertEqual(wallet.verification?.message, "Verify to withdraw ₦1,280.50")
    }

    func testOrdersWidgetUsesAuthenticatedOrdersEndpointAndDecodesOnlyRequiredFields() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"orders":[{"id":"550e8400-e29b-41d4-a716-446655440000","reference":"NT-102","status":"shipped","statusLabel":"On the way","etaAt":"2026-11-02T15:00:00Z","itemTitle":"Linen set","itemCount":2,"imageUrl":"https://cdn.example.test/private.jpg","storeName":"Ade's Store","deepLink":"https://attacker.example/","updatedAt":"2026-11-02T12:00:00Z"}],"activeCount":1,"generatedAt":"2026-11-02T12:00:00Z"}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(
            session: URLSession(configuration: configuration),
            baseURLProvider: { "https://api.nantty.test" }
        )

        let payload = try await api.fetchOrdersWidget(accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/widgets/orders")
        XCTAssertEqual(observedRequest?.httpMethod, "GET")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(payload.activeCount, 1)
        XCTAssertEqual(payload.orders.first?.reference, "NT-102")
        XCTAssertEqual(payload.orders.first?.storeName, "Ade's Store")
    }

    func testNotificationsUseAuthenticatedFilterAndOpaqueCursor() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"data":[{"id":"n1","category":"social","kind":"mention","title":"Ada mentioned you","body":"Hello","createdAt":"2026-11-02T10:00:00Z","read":false,"actor":{"id":"u1","name":"Ada","username":"ada","avatarUrl":null,"verified":true},"url":"/posts/p1","data":{"postId":"p1"}}],"nextCursor":"next+cursor&opaque"}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })
        let cursor = "cursor/+&opaque"
        let page = try await api.fetchNotifications(filter: .mentions, cursor: cursor, accessToken: "session-token")

        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/notifications")
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(observedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "filter", value: "mentions"), URLQueryItem(name: "cursor", value: cursor)])
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        XCTAssertEqual(page.data.first?.id, "n1")
        XCTAssertEqual(page.nextCursor, "next+cursor&opaque")
    }

    func testConversationInboxUsesAuthenticatedChatsFolderAndBoundedCursorPage() async throws {
        var observedRequest: URLRequest?
        StubURLProtocol.handler = { request in
            observedRequest = request
            return (200, Data("""
            {"data":[{"id":"conversation-1","peer":{"id":"peer-1","name":"Ada","username":"ada","avatarUrl":null,"verified":false,"isCreator":false},"lastMessage":"","lastMessageAt":"2026-11-02T10:30:00Z","unread":1,"kind":"direct","title":null,"store":null}],"nextCursor":null}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })
        let page = try await api.fetchConversationInbox(accessToken: "session-token", cursor: "cursor-1")

        XCTAssertEqual(page.data.first?.displayTitle, "Ada")
        XCTAssertEqual(observedRequest?.url?.path, "/api/v1/conversations")
        XCTAssertEqual(observedRequest?.httpMethod, "GET")
        XCTAssertEqual(observedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer session-token")
        let query = URLComponents(url: try XCTUnwrap(observedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems
        XCTAssertEqual(query?.first(where: { $0.name == "folder" })?.value, "chats")
        XCTAssertEqual(query?.first(where: { $0.name == "limit" })?.value, "20")
        XCTAssertEqual(query?.first(where: { $0.name == "cursor" })?.value, "cursor-1")
    }

    func testWalletTransactionsUseAuthenticatedCursorQueryWithoutLoggingCredentials() async throws {
        var observedRequests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            observedRequests.append(request)
            return (200, Data("{\"data\":[],\"nextCursor\":null}".utf8))
        }
        defer { StubURLProtocol.handler = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })
        let cursor = "opaque/+&cursor"

        _ = try await api.fetchWalletTransactions(accessToken: "session-token", cursor: nil)
        let page = try await api.fetchWalletTransactions(accessToken: "session-token", cursor: cursor)

        XCTAssertEqual(observedRequests.count, 2)
        XCTAssertEqual(observedRequests.map { $0.url?.path }, ["/api/v1/wallets/me/transactions", "/api/v1/wallets/me/transactions"])
        XCTAssertNil(URLComponents(url: try XCTUnwrap(observedRequests[0].url), resolvingAgainstBaseURL: false)?.queryItems)
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(observedRequests[1].url), resolvingAgainstBaseURL: false)?.queryItems,
                       [URLQueryItem(name: "cursor", value: cursor)])
        XCTAssertTrue(observedRequests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer session-token" })
        XCTAssertTrue(observedRequests.allSatisfy { $0.httpBody == nil })
        XCTAssertTrue(page.data.isEmpty)
        XCTAssertNil(page.nextCursor)
    }

    func testNotificationReadActionsUseAuthenticatedNoContentRoutes() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in requests.append(request); return (204, Data()) }
        defer { StubURLProtocol.handler = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })

        try await api.markNotificationRead(id: "note-1", accessToken: "session-token")
        try await api.markAllNotificationsRead(accessToken: "session-token")

        XCTAssertEqual(requests.map(\.httpMethod), ["POST", "POST"])
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/notifications/note-1/read", "/api/v1/notifications/read-all"])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer session-token" })
        XCTAssertTrue(requests.allSatisfy { $0.httpBody == nil })
    }

    func testCurrentProfileUsesOnlyAuthenticatedMeGetAndPatchAndDecodesAllowlistedFields() async throws {
        var requests: [URLRequest] = []
        StubURLProtocol.handler = { request in
            requests.append(request)
            return (200, Data("""
            {"id":"private-account-id","name":"Ada","username":"ada","bio":"Hello","website":null,
             "followers":4,"following":3,"posts":2,"isPrivate":true,"email":"private@example.test",
             "roles":["admin"],"birthday":"2000-01-01","emailVerified":true}
            """.utf8))
        }
        defer { StubURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let api = SessionAPI(session: URLSession(configuration: configuration), baseURLProvider: { "https://api.nantty.test" })
        let profile = try await api.fetchMyProfile(accessToken: "keychain-session-token")
        let updated = try await api.updateMyProfile(
            MyProfileUpdate(name: "Ada Lovelace", bio: "Builder", isPrivate: false),
            accessToken: "keychain-session-token"
        )

        XCTAssertEqual(profile.name, "Ada")
        XCTAssertEqual(profile.username, "ada")
        XCTAssertEqual(profile.followers, 4)
        XCTAssertTrue(profile.isPrivate)
        XCTAssertEqual(updated.name, "Ada")
        XCTAssertEqual(requests.map { $0.url?.path }, ["/api/v1/users/me", "/api/v1/users/me"])
        XCTAssertEqual(requests.map(\.httpMethod), ["GET", "PATCH"])
        XCTAssertTrue(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer keychain-session-token" })
        let patchBody = try XCTUnwrap(requests[1].httpBody)
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: patchBody) as? [String: Any])
        XCTAssertEqual(payload["name"] as? String, "Ada Lovelace")
        XCTAssertEqual(payload["bio"] as? String, "Builder")
        XCTAssertEqual(payload["isPrivate"] as? Bool, false)
        XCTAssertEqual(payload.count, 3)
    }
}

private final class StubURLProtocol: URLProtocol {
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
