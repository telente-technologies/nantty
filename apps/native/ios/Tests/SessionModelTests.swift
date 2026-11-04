import XCTest
@testable import Nantty

final class SessionModelTests: XCTestCase {
    func testDecodesLoginResponseAndUser() throws {
        let data = Data("""
        {"accessToken":"access","refreshToken":"refresh","user":{"id":"u1","name":"Ada","username":"ada","email":"ada@example.com","avatarUrl":null,"accountStatus":"active"}}
        """.utf8)

        let session = try SessionPayloadDecoder.decode(AuthSession.self, from: data)

        XCTAssertEqual(session.tokens, SessionTokens(accessToken: "access", refreshToken: "refresh"))
        XCTAssertEqual(session.user.id, "u1")
        XCTAssertEqual(session.user.username, "ada")
    }

    func testDecodesDataWrappedRefreshResponse() throws {
        let data = Data("{\"data\":{\"accessToken\":\"rotated-access\",\"refreshToken\":\"rotated-refresh\"}}".utf8)

        let tokens = try SessionPayloadDecoder.decode(SessionTokens.self, from: data)

        XCTAssertEqual(tokens, SessionTokens(accessToken: "rotated-access", refreshToken: "rotated-refresh"))
    }

    func testSignInValidationRejectsMissingFieldsWithoutChangingPassword() {
        XCTAssertNotNil(SignInValidation.message(identifier: "  ", password: "secret"))
        XCTAssertNotNil(SignInValidation.message(identifier: "ada", password: ""))
        XCTAssertNil(SignInValidation.message(identifier: "ada", password: " secret "))
    }

    func testRemoteAPIRequiresHTTPSAndLoopbackMayUseHTTP() {
        XCTAssertNil(APIConfiguration(rawValue: "http://api.example.com"))
        XCTAssertNotNil(APIConfiguration(rawValue: "https://api.example.com"))
        XCTAssertNotNil(APIConfiguration(rawValue: "http://localhost:8080"))
    }

    @MainActor
    func testSignOutClearsLocalCredentialsWhenRemoteLogoutFails() async throws {
        let tokenPair = SessionTokens(accessToken: "access", refreshToken: "refresh")
        let credentials = InMemoryCredentialStore(tokens: tokenPair)
        let api = MockSessionService()
        api.logoutError = TestError.logoutUnavailable
        let model = SessionModel(credentialStore: credentials, api: api)

        await model.signOut()

        XCTAssertNil(try credentials.load())
        XCTAssertEqual(model.phase, .signedOut)
        XCTAssertEqual(api.lastLogoutAccessToken, "access")
    }

    @MainActor
    func testRestoreRotatesAndPersistsTokensBeforeLoadingCurrentUser() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "old", refreshToken: "old-refresh"))
        let api = MockSessionService()
        api.refreshedTokens = SessionTokens(accessToken: "new", refreshToken: "new-refresh")
        api.user = SessionUser(id: "u1", name: "Ada", username: "ada", email: nil, avatarURL: nil, accountStatus: "active")
        let model = SessionModel(credentialStore: credentials, api: api)

        await model.restoreSession()

        XCTAssertEqual(try credentials.load(), api.refreshedTokens)
        XCTAssertEqual(model.phase, .signedIn)
        XCTAssertEqual(model.user?.id, "u1")
    }

    @MainActor
    func testCurrentProfileUsesOnlyTheKeychainSessionToken() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "profile-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.refreshedTokens = SessionTokens(accessToken: "profile-access", refreshToken: "rotated-refresh")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let profile = try await model.fetchMyProfile()
        let updated = try await model.updateMyProfile(MyProfileUpdate(name: "Ada", bio: "Builder", isPrivate: true))

        XCTAssertEqual(profile.username, "ada")
        XCTAssertEqual(updated.name, "Ada")
        XCTAssertEqual(api.lastMyProfileAccessToken, "profile-access")
        XCTAssertEqual(api.lastMyProfileUpdateAccessToken, "profile-access")
        XCTAssertEqual(api.lastMyProfileUpdate, MyProfileUpdate(name: "Ada", bio: "Builder", isPrivate: true))
    }

    @MainActor
    func testPostLinkClickUsesOnlyTheCurrentKeychainSessionAndPostIdentifier() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "link-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.refreshedTokens = SessionTokens(accessToken: "link-access", refreshToken: "rotated-refresh")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        await model.recordPostLinkClick(postID: "post-1")

        XCTAssertEqual(api.lastFeedInteractionAccessToken, "link-access")
        XCTAssertEqual(api.lastFeedInteraction, .postDetailLinkClick(postID: "post-1"))
    }

    func testProfileFormLimitsMatchReactNative() {
        XCTAssertNil(MyProfileFormValidation.message(name: String(repeating: "a", count: 50), bio: String(repeating: "b", count: 160)))
        XCTAssertNotNil(MyProfileFormValidation.message(name: String(repeating: "a", count: 51), bio: ""))
        XCTAssertNotNil(MyProfileFormValidation.message(name: "Ada", bio: String(repeating: "b", count: 161)))
    }

    @MainActor
    func testReplyUsesKeychainAccessTokenThroughSessionBoundary() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.refreshedTokens = SessionTokens(accessToken: "keychain-access", refreshToken: "rotated-refresh")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        _ = try await model.submitReply(postID: "post-1", text: "  Hello  ")

        XCTAssertEqual(api.lastCommentAccessToken, "keychain-access")
        XCTAssertEqual(api.lastCommentRequest, CreateThreadCommentRequest(text: "Hello", parentCommentId: nil))
    }

    @MainActor
    func testNestedReplyPreservesParentCommentThroughSessionBoundary() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        _ = try await model.submitReply(postID: "post-1", text: "  Nested reply  ", parentCommentID: "comment-parent")

        XCTAssertEqual(api.lastCommentAccessToken, "keychain-access")
        XCTAssertEqual(api.lastCommentRequest, CreateThreadCommentRequest(text: "Nested reply", parentCommentId: "comment-parent"))
    }

    @MainActor
    func testSavePostUsesSessionCredentialBoundaryAndRejectsGuests() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        try await model.setPostSaved(postID: "post-1", saved: true)

        XCTAssertEqual(api.lastSaveAccessToken, "keychain-access")
        XCTAssertEqual(api.postSaveActions.map { ($0.0, $0.1) }.map { "\($0.0):\($0.1)" }, ["post-1:true"])
        XCTAssertEqual(try credentials.load()?.accessToken, "keychain-access", "Save must not create or persist a separate token")

        let guestAPI = MockSessionService()
        let guest = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: guestAPI)
        await guest.restoreSession()
        do {
            try await guest.setPostSaved(postID: "post-1", saved: true)
            XCTFail("Guests must not save posts")
        } catch {
            XCTAssertEqual(error.localizedDescription, SessionActionError.signInRequiredForPostAction.errorDescription)
        }
        XCTAssertTrue(guestAPI.postSaveActions.isEmpty)
    }

    @MainActor
    func testSavedPostsUseKeychainCredentialBoundaryAndRequireSignIn() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.savedPostsPage = SavedPostsPage(data: [], nextCursor: "next-save")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let page = try await model.fetchSavedPosts(cursor: "cursor-1")

        XCTAssertEqual(api.lastSavedPostsAccessToken, "keychain-access")
        XCTAssertEqual(api.lastSavedPostsCursor, "cursor-1")
        XCTAssertEqual(page.nextCursor, "next-save")
        XCTAssertEqual(try credentials.load()?.accessToken, "keychain-access", "Saved-post reads must not create or persist another token")

        let guestAPI = MockSessionService()
        let guest = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: guestAPI)
        await guest.restoreSession()
        do {
            _ = try await guest.fetchSavedPosts()
            XCTFail("Guests must not fetch private saved posts")
        } catch {
            XCTAssertEqual(error.localizedDescription, SessionActionError.signInRequiredForPostAction.errorDescription)
        }
        XCTAssertNil(guestAPI.lastSavedPostsAccessToken)
    }

    @MainActor
    func testManagedProfileReplyUsesKeychainTokenAndPreservesNestedParent() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        _ = try await model.submitReply(postID: "post-1", text: "  Store reply  ", parentCommentID: "comment-parent", asProfileID: "store-1")

        XCTAssertEqual(api.lastCommentAccessToken, "keychain-access")
        XCTAssertEqual(api.lastCommentRequest, CreateThreadCommentRequest(text: "Store reply", parentCommentId: "comment-parent", asProfileId: "store-1"))
    }

    @MainActor
    func testCommentProfilesRequireSignedInSessionAndRemainInMemory() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.commentProfiles = ManagedCommentProfilesPage(data: [
            ManagedCommentProfile(id: "brand-1", kind: "brand", name: "Ada Brand", handle: "adabrand", onHold: nil),
            ManagedCommentProfile(id: "held-1", kind: "store", name: "Held", handle: "held", onHold: true),
            ManagedCommentProfile(id: "person-1", kind: "person", name: "Ada", handle: "ada", onHold: false)
        ])
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let available = try await model.fetchCommentProfiles()

        XCTAssertEqual(api.lastProfilesAccessToken, "keychain-access")
        XCTAssertEqual(available.map(\.id), ["brand-1"])
        XCTAssertEqual(try credentials.load()?.accessToken, "keychain-access", "Profile selection is not written into credentials or persistent storage")
    }

    @MainActor
    func testManagedProfileReplyRequiresSignedInSession() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.submitReply(postID: "post-1", text: "Reply", asProfileID: "store-1")
            XCTFail("A signed-out session must not comment as a managed profile")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to reply to this post.")
        }
        XCTAssertNil(api.lastCommentAccessToken)
    }

    @MainActor
    func testTextPostUsesKeychainAccessTokenAndTrimsText() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let postID = try await model.submitTextPost(text: "  Hello Nantty  ", idempotencyKey: "attempt-123")

        XCTAssertEqual(postID, "post-created")
        XCTAssertEqual(api.lastCreatePostAccessToken, "keychain-access")
        XCTAssertEqual(api.lastCreatePostText, "Hello Nantty")
        XCTAssertEqual(api.lastCreatePostIdempotencyKey, "attempt-123")
    }

    @MainActor
    func testTextPostRequiresSignedInSessionAndDoesNotCallAPI() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.submitTextPost(text: "Hello", idempotencyKey: "attempt-123")
            XCTFail("A signed-out session must not publish a post")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to create a post.")
        }
        XCTAssertNil(api.lastCreatePostAccessToken)
    }

    func testTextPostValidationEnforcesTrimmedNonemptyAndBackendLength() {
        XCTAssertNotNil(TextPostValidation.error(for: " \n "))
        XCTAssertNil(TextPostValidation.error(for: String(repeating: "a", count: 2_200)))
        XCTAssertNotNil(TextPostValidation.error(for: String(repeating: "a", count: 2_201)))
        XCTAssertNotNil(TextPostValidation.error(for: String(repeating: "😀", count: 1_101)))
    }

    @MainActor
    func testLikeAndRepostUseKeychainAccessTokenThroughSessionBoundary() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        try await model.setPostLiked(postID: "post-1", liked: true)
        try await model.setPostReposted(postID: "post-1", reposted: true)
        try await model.setPostReposted(postID: "post-1", reposted: false)

        XCTAssertEqual(api.lastPostActionAccessToken, "keychain-access")
        XCTAssertEqual(api.postLikeActions.count, 1)
        XCTAssertEqual(api.postLikeActions[0].0, "post-1")
        XCTAssertTrue(api.postLikeActions[0].1)
        XCTAssertEqual(api.postRepostActions.count, 2)
        XCTAssertEqual(api.postRepostActions[0].0, "post-1")
        XCTAssertTrue(api.postRepostActions[0].1)
        XCTAssertEqual(api.postRepostActions[1].0, "post-1")
        XCTAssertFalse(api.postRepostActions[1].1)
    }

    @MainActor
    func testCompletedShareRecordingUsesCurrentSessionToken() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "share-session-token", refreshToken: "refresh"))
        let api = MockSessionService()
        api.refreshedTokens = SessionTokens(accessToken: "share-session-token", refreshToken: "rotated-refresh")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        try await model.recordPostShare(postID: "post-1")

        XCTAssertEqual(api.lastSharedPostID, "post-1")
        XCTAssertEqual(api.lastShareAccessToken, "share-session-token")
    }

    @MainActor
    func testCompletedGuestShareRecordingUsesOptionalAuthentication() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        try await model.recordPostShare(postID: "post-1")

        XCTAssertEqual(api.lastSharedPostID, "post-1")
        XCTAssertNil(api.lastShareAccessToken)
    }

    @MainActor
    func testPostActionRequiresSignedInKeychainSession() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            try await model.setPostLiked(postID: "post-1", liked: true)
            XCTFail("A signed-out session must not issue a Like request")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to like or repost this post.")
        }
        do {
            try await model.setPostReposted(postID: "post-1", reposted: true)
            XCTFail("A signed-out session must not issue a Repost request")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to like or repost this post.")
        }
        XCTAssertNil(api.lastPostActionAccessToken)
        XCTAssertTrue(api.postLikeActions.isEmpty)
        XCTAssertTrue(api.postRepostActions.isEmpty)
    }

    @MainActor
    func testWalletReadUsesKeychainAccessTokenThroughSessionBoundary() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "wallet-session-token", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let wallet = try await model.fetchWalletSummary()

        XCTAssertEqual(api.lastWalletAccessToken, "wallet-session-token")
        XCTAssertEqual(wallet.available.amountMinor, 125_050)
    }

    @MainActor
    func testWalletReadRequiresSignedInKeychainSession() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchWalletSummary()
            XCTFail("A signed-out session must not request wallet data")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your wallet.")
        }
        XCTAssertNil(api.lastWalletAccessToken)
    }

    @MainActor
    func testWalletTransactionsUseKeychainAccessTokenAndPreserveReadOnlyPage() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "wallet-keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let transaction = WalletTransaction(
            id: "ledger-line-1",
            kind: "credit",
            amount: WalletMoney(amountMinor: 12_500, currency: "NGN"),
            description: "Wallet top-up",
            createdAt: "2026-11-02T10:30:00Z",
            status: "completed"
        )
        api.walletTransactionsPage = WalletTransactionsPage(data: [transaction], nextCursor: "cursor-next", total: nil)
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let page = try await model.fetchWalletTransactions(cursor: "opaque/+&next")

        XCTAssertEqual(api.lastWalletTransactionsAccessToken, "wallet-keychain-access")
        XCTAssertEqual(api.lastWalletTransactionsCursor, "opaque/+&next")
        XCTAssertEqual(page.data, [transaction])
        XCTAssertEqual(page.nextCursor, "cursor-next")
        XCTAssertEqual(try credentials.load()?.accessToken, "wallet-keychain-access")
    }

    @MainActor
    func testWalletEscrowHoldsUseKeychainAccessTokenAndReturnReadOnlyData() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "wallet-escrow-token", refreshToken: "refresh"))
        let api = MockSessionService()
        let hold = WalletEscrowHold(
            orderId: "order-1",
            orderReference: "NAN-1042",
            productName: "Handwoven bag",
            amount: WalletMoney(amountMinor: 12_500, currency: "NGN"),
            stage: "shipped",
            expectedReleaseAt: "2026-11-08T12:00:00Z"
        )
        api.walletEscrowHoldsPage = WalletEscrowHoldsPage(data: [hold])
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let page = try await model.fetchWalletEscrowHolds()

        XCTAssertEqual(api.lastWalletEscrowHoldsAccessToken, "wallet-escrow-token")
        XCTAssertEqual(page.data, [hold])
        XCTAssertEqual(try credentials.load()?.accessToken, "wallet-escrow-token")
    }

    @MainActor
    func testWalletTransactionsRequireSignedInKeychainSession() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchWalletTransactions(cursor: nil)
            XCTFail("A signed-out session must not request wallet transactions")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your wallet.")
        }
        XCTAssertNil(api.lastWalletTransactionsAccessToken)
    }

    @MainActor
    func testExpiredWalletTransactionsSessionClearsKeychainCredentials() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "expired", refreshToken: "refresh"))
        let api = MockSessionService()
        api.walletTransactionsError = SessionAPIError.httpStatus(401, "expired")
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchWalletTransactions(cursor: "opaque-next")
            XCTFail("An expired wallet session must not return a page")
        } catch let error as SessionAPIError {
            XCTAssertEqual(error.statusCode, 401)
        }

        XCTAssertEqual(api.lastWalletTransactionsCursor, "opaque-next")
        XCTAssertNil(try credentials.load())
        XCTAssertEqual(model.phase, .signedOut)
    }

    @MainActor
    func testUnavailableWalletCredentialStoreClearsVisibleSignedInSession() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()
        credentials.loadError = TestError.credentialStoreUnavailable

        do {
            _ = try await model.fetchWalletTransactions(cursor: nil)
            XCTFail("Wallet access must fail closed when the Keychain cannot be read")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your wallet.")
        }

        XCTAssertNil(model.user)
        XCTAssertEqual(model.phase, .restoreUnavailable)
        XCTAssertNil(api.lastWalletTransactionsAccessToken)
    }

    @MainActor
    func testOrdersWidgetReadUsesKeychainSessionAndDoesNotRequireUserSuppliedIdentity() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "orders-session-token", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let payload = try await model.fetchOrdersWidget()

        XCTAssertEqual(api.lastOrdersWidgetAccessToken, "orders-session-token")
        XCTAssertEqual(payload.activeCount, 0)
    }

    @MainActor
    func testOrdersWidgetReadRequiresSignedInSession() async throws {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchOrdersWidget()
            XCTFail("A signed-out session must not request order data")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your orders.")
        }
        XCTAssertNil(api.lastOrdersWidgetAccessToken)
    }

    @MainActor
    func testFollowingFeedUsesKeychainTokenAndPassesCursor() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "old", refreshToken: "refresh"))
        let feed = MockFeedFetcher()
        let model = SessionModel(
            credentialStore: credentials,
            api: MockSessionService(),
            feedFetcherFactory: { _ in feed }
        )
        await model.restoreSession()

        let page = try await model.fetchFeed(baseURL: "https://api.nantty.test", kind: .following, cursor: "next-page")

        XCTAssertEqual(feed.lastKind, .following)
        XCTAssertEqual(feed.lastCursor, "next-page")
        XCTAssertEqual(feed.lastAccessToken, "new")
        XCTAssertEqual(page.nextCursor, "next")
    }

    @MainActor
    func testSignedOutFollowingFeedDoesNotCallFeedService() async throws {
        let credentials = InMemoryCredentialStore(tokens: nil)
        let feed = MockFeedFetcher()
        let model = SessionModel(
            credentialStore: credentials,
            api: MockSessionService(),
            feedFetcherFactory: { _ in feed }
        )
        await model.restoreSession()

        do {
            _ = try await model.fetchFeed(baseURL: "https://api.nantty.test", kind: .following)
            XCTFail("Signed-out viewers must not request Following")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view posts from people you follow.")
        }
        XCTAssertEqual(feed.requestCount, 0)
    }

    @MainActor
    func testExpiredFollowingSessionClearsKeychainAndRejectsFeedPage() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "old", refreshToken: "refresh"))
        let feed = MockFeedFetcher()
        feed.fetchError = FeedServiceError.httpStatus(401)
        let model = SessionModel(
            credentialStore: credentials,
            api: MockSessionService(),
            feedFetcherFactory: { _ in feed }
        )
        await model.restoreSession()

        do {
            _ = try await model.fetchFeed(baseURL: "https://api.nantty.test", kind: .following)
            XCTFail("An expired session must not return Following content")
        } catch {
            XCTAssertEqual((error as? FeedServiceError)?.statusCode, 401)
        }

        XCTAssertNil(try credentials.load())
        XCTAssertEqual(model.phase, .signedOut)
        XCTAssertNil(model.user)
        XCTAssertEqual(feed.lastAccessToken, "new")
    }

    @MainActor
    func testNotificationsUseKeychainSessionAndPassFilterAndCursor() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        _ = try await model.fetchNotifications(filter: .mentions, cursor: "opaque-cursor")
        try await model.markNotificationRead(id: "notification-1")
        try await model.markAllNotificationsRead()

        XCTAssertEqual(api.lastNotificationsAccessToken, "keychain-access")
        XCTAssertEqual(api.lastNotificationFilter, .mentions)
        XCTAssertEqual(api.lastNotificationCursor, "opaque-cursor")
        XCTAssertEqual(api.lastReadNotificationID, "notification-1")
        XCTAssertTrue(api.markedAllNotificationsRead)
    }

    @MainActor
    func testSignedOutNotificationsDoNotCallAPI() async {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchNotifications(filter: .all)
            XCTFail("Signed-out sessions must not fetch notifications")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your notifications.")
        }
        XCTAssertNil(api.lastNotificationsAccessToken)
    }

    @MainActor
    func testNotificationResponseIsRejectedAfterKeychainSessionChanges() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        api.onFetchNotifications = {
            try? credentials.save(SessionTokens(accessToken: "replacement-access", refreshToken: "replacement-refresh"))
        }
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchNotifications(filter: .all)
            XCTFail("A response for a replaced Keychain session must be discarded")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Your account changed. Open Nantty to refresh this widget.")
        }
    }

    @MainActor
    func testConversationInboxUsesKeychainSessionAndRejectsReplacedIdentity() async throws {
        let credentials = InMemoryCredentialStore(tokens: SessionTokens(accessToken: "keychain-access", refreshToken: "refresh"))
        let api = MockSessionService()
        let model = SessionModel(credentialStore: credentials, api: api)
        await model.restoreSession()

        let page = try await model.fetchConversationInbox(cursor: "cursor-2")

        XCTAssertEqual(api.lastInboxAccessToken, "keychain-access")
        XCTAssertEqual(api.lastInboxCursor, "cursor-2")
        XCTAssertEqual(page.data, [])

        api.onFetchInbox = {
            try? credentials.save(SessionTokens(accessToken: "replacement-access", refreshToken: "replacement-refresh"))
        }
        do {
            _ = try await model.fetchConversationInbox()
            XCTFail("A response from a replaced account session must not be used")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Your account changed. Open Nantty to refresh this widget.")
        }
    }

    @MainActor
    func testSignedOutConversationInboxDoesNotCallAPI() async {
        let api = MockSessionService()
        let model = SessionModel(credentialStore: InMemoryCredentialStore(tokens: nil), api: api)
        await model.restoreSession()

        do {
            _ = try await model.fetchConversationInbox()
            XCTFail("Signed-out sessions must not fetch conversations")
        } catch {
            XCTAssertEqual(error.localizedDescription, "Sign in to view your conversations.")
        }
        XCTAssertNil(api.lastInboxAccessToken)
    }
}

private final class InMemoryCredentialStore: SessionCredentialStoring {
    private var tokens: SessionTokens?
    var loadError: Error?

    init(tokens: SessionTokens?) {
        self.tokens = tokens
    }

    func load() throws -> SessionTokens? {
        if let loadError { throw loadError }
        return tokens
    }

    func save(_ tokens: SessionTokens) throws {
        self.tokens = tokens
    }

    func clear() throws {
        tokens = nil
    }
}

private enum TestError: Error {
    case logoutUnavailable
    case credentialStoreUnavailable
}

private final class MockFeedFetcher: FeedFetching {
    var requestCount = 0
    var lastKind: FeedKind?
    var lastCursor: String?
    var lastAccessToken: String?
    var fetchError: Error?

    func fetch(feed: FeedKind, cursor: String?, accessToken: String?) async throws -> FeedPage {
        requestCount += 1
        lastKind = feed
        lastCursor = cursor
        lastAccessToken = accessToken
        if let fetchError { throw fetchError }
        return FeedPage(data: [], nextCursor: "next")
    }
}

private final class MockSessionService: SessionServicing {
    var refreshedTokens = SessionTokens(accessToken: "new", refreshToken: "new-refresh")
    var user = SessionUser(id: "u1", name: "Ada", username: "ada", email: nil, avatarURL: nil, accountStatus: "active")
    var myProfile = MyProfile(name: "Ada", username: "ada", bio: "", website: nil, followers: 0, following: 0, posts: 0, isPrivate: false)
    var lastMyProfileAccessToken: String?
    var lastMyProfileUpdateAccessToken: String?
    var lastMyProfileUpdate: MyProfileUpdate?
    var logoutError: Error?
    var lastLogoutAccessToken: String?
    var lastCommentAccessToken: String?
    var lastCommentRequest: CreateThreadCommentRequest?
    var lastProfilesAccessToken: String?
    var commentProfiles = ManagedCommentProfilesPage(data: [])
    var lastPostActionAccessToken: String?
    var lastSharedPostID: String?
    var lastShareAccessToken: String?
    var lastFeedInteraction: FeedInteraction?
    var lastFeedInteractionAccessToken: String?
    var lastCreatePostAccessToken: String?
    var lastCreatePostText: String?
    var lastCreatePostIdempotencyKey: String?
    var lastWalletAccessToken: String?
    var lastWalletTransactionsAccessToken: String?
    var lastWalletTransactionsCursor: String?
    var walletTransactionsPage = WalletTransactionsPage(data: [], nextCursor: nil, total: nil)
    var walletTransactionsError: Error?
    var lastWalletEscrowHoldsAccessToken: String?
    var walletEscrowHoldsPage = WalletEscrowHoldsPage(data: [])
    var walletEscrowHoldsError: Error?
    var lastOrdersWidgetAccessToken: String?
    var lastNotificationsAccessToken: String?
    var lastNotificationFilter: NotificationFilter?
    var lastNotificationCursor: String?
    var lastReadNotificationID: String?
    var notificationPages: [NotificationsPage] = []
    var notificationError: Error?
    var markedAllNotificationsRead = false
    var onFetchNotifications: (() -> Void)?
    var lastInboxAccessToken: String?
    var lastInboxCursor: String?
    var onFetchInbox: (() -> Void)?
    var postLikeActions: [(String, Bool)] = []
    var postRepostActions: [(String, Bool)] = []
    var postSaveActions: [(String, Bool)] = []
    var lastSaveAccessToken: String?
    var lastSavedPostsAccessToken: String?
    var lastSavedPostsCursor: String?
    var savedPostsPage = SavedPostsPage(data: [], nextCursor: nil)

    func signIn(identifier: String, password: String) async throws -> AuthSession {
        AuthSession(accessToken: "access", refreshToken: "refresh", user: user)
    }

    func refresh(refreshToken: String) async throws -> SessionTokens {
        refreshedTokens
    }

    func currentUser(accessToken: String) async throws -> SessionUser {
        user
    }

    func fetchMyProfile(accessToken: String) async throws -> MyProfile {
        lastMyProfileAccessToken = accessToken
        return myProfile
    }

    func updateMyProfile(_ update: MyProfileUpdate, accessToken: String) async throws -> MyProfile {
        lastMyProfileUpdateAccessToken = accessToken
        lastMyProfileUpdate = update
        myProfile = MyProfile(name: update.name, username: "ada", bio: update.bio, website: nil, followers: 0, following: 0, posts: 0, isPrivate: update.isPrivate)
        return myProfile
    }

    func signOut(accessToken: String) async throws {
        lastLogoutAccessToken = accessToken
        if let logoutError { throw logoutError }
    }

    func fetchPost(postID: String, accessToken: String) async throws -> ThreadPost {
        lastPostActionAccessToken = accessToken
        return ThreadPost(
            id: postID,
            author: .init(name: "Ada", username: "ada", avatarUrl: nil, verified: false),
            createdAt: "2026-11-02T00:00:00Z",
            text: "Post",
            media: [],
            likes: 1,
            liked: false,
            bookmarked: false,
            reposts: 2,
            reposted: false
        )
    }

    func fetchSavedPosts(cursor: String?, accessToken: String) async throws -> SavedPostsPage {
        lastSavedPostsAccessToken = accessToken
        lastSavedPostsCursor = cursor
        return savedPostsPage
    }

    func fetchCommentProfiles(accessToken: String) async throws -> ManagedCommentProfilesPage {
        lastProfilesAccessToken = accessToken
        return commentProfiles
    }

    func setPostLiked(postID: String, liked: Bool, accessToken: String) async throws {
        lastPostActionAccessToken = accessToken
        postLikeActions.append((postID, liked))
    }

    func setPostReposted(postID: String, reposted: Bool, accessToken: String) async throws {
        lastPostActionAccessToken = accessToken
        postRepostActions.append((postID, reposted))
    }

    func setPostSaved(postID: String, saved: Bool, accessToken: String) async throws {
        lastSaveAccessToken = accessToken
        postSaveActions.append((postID, saved))
    }

    func recordPostShare(postID: String, accessToken: String?) async throws {
        lastSharedPostID = postID
        lastShareAccessToken = accessToken
    }

    func recordFeedInteraction(_ interaction: FeedInteraction, accessToken: String) async throws {
        lastFeedInteraction = interaction
        lastFeedInteractionAccessToken = accessToken
    }

    func createComment(postID: String, text: String, parentCommentID: String?, asProfileID: String?, accessToken: String) async throws -> ThreadComment {
        lastCommentAccessToken = accessToken
        lastCommentRequest = CreateThreadCommentRequest(text: text, parentCommentId: parentCommentID, asProfileId: asProfileID)
        return ThreadComment(id: "c1", postId: postID, parentCommentId: parentCommentID, author: .init(name: "Ada", username: "ada", avatarUrl: nil, verified: false), text: text, createdAt: "2026-11-02T00:00:00Z", inlineReplies: [])
    }

    func createTextPost(text: String, accessToken: String, idempotencyKey: String) async throws -> String {
        lastCreatePostAccessToken = accessToken
        lastCreatePostText = text
        lastCreatePostIdempotencyKey = idempotencyKey
        return "post-created"
    }

    func fetchWalletSummary(accessToken: String) async throws -> WalletSummary {
        lastWalletAccessToken = accessToken
        return WalletSummary(
            available: WalletMoney(amountMinor: 125_050, currency: "NGN"),
            pending: WalletMoney(amountMinor: 9_000, currency: "NGN"),
            locked: nil,
            inEscrow: nil,
            payoutRequested: nil,
            negativeBalance: nil,
            nextAvailableAt: nil,
            adCredit: nil,
            earningsPayable: nil,
            debts: nil,
            coins: WalletCoinHoldings(spendable: 42, earned: 8),
            lines: nil,
            verification: nil
        )
    }

    func fetchWalletTransactions(accessToken: String, cursor: String?) async throws -> WalletTransactionsPage {
        lastWalletTransactionsAccessToken = accessToken
        lastWalletTransactionsCursor = cursor
        if let walletTransactionsError { throw walletTransactionsError }
        return walletTransactionsPage
    }

    func fetchWalletEscrowHolds(accessToken: String) async throws -> WalletEscrowHoldsPage {
        lastWalletEscrowHoldsAccessToken = accessToken
        if let walletEscrowHoldsError { throw walletEscrowHoldsError }
        return walletEscrowHoldsPage
    }

    func fetchOrdersWidget(accessToken: String) async throws -> OrdersWidgetAPIResponse {
        lastOrdersWidgetAccessToken = accessToken
        return OrdersWidgetAPIResponse(orders: [], activeCount: 0, generatedAt: "2026-11-02T12:00:00Z")
    }

    func fetchNotifications(filter: NotificationFilter, cursor: String?, accessToken: String) async throws -> NotificationsPage {
        lastNotificationsAccessToken = accessToken
        lastNotificationFilter = filter
        lastNotificationCursor = cursor
        onFetchNotifications?()
        if let notificationError { throw notificationError }
        return notificationPages.first ?? NotificationsPage(data: [], nextCursor: nil)
    }

    func fetchConversationInbox(accessToken: String, cursor: String?) async throws -> ConversationInboxPage {
        lastInboxAccessToken = accessToken
        lastInboxCursor = cursor
        onFetchInbox?()
        return ConversationInboxPage(data: [], nextCursor: nil)
    }

    func markNotificationRead(id: String, accessToken: String) async throws {
        lastNotificationsAccessToken = accessToken
        lastReadNotificationID = id
        if let notificationError { throw notificationError }
    }

    func markAllNotificationsRead(accessToken: String) async throws {
        lastNotificationsAccessToken = accessToken
        markedAllNotificationsRead = true
        if let notificationError { throw notificationError }
    }
}
