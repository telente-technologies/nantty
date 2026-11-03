import Foundation
import Observation

enum SessionPhase: Equatable {
    case restoring
    case signedOut
    case signedIn
    case restoreUnavailable
}

@MainActor
@Observable
final class SessionModel {
    private(set) var phase: SessionPhase = .restoring
    private(set) var user: SessionUser?
    private(set) var isWorking = false
    private(set) var isPostActionInProgress = false
    private(set) var message: String?

    private let credentialStore: SessionCredentialStoring
    private let api: SessionServicing
    private let feedFetcherFactory: (String) -> any FeedFetching
    private let searchFetcherFactory: (String) -> SearchPostsService
    private var hasStartedRestoration = false

    init(
        credentialStore: SessionCredentialStoring = KeychainSessionCredentialStore(),
        api: SessionServicing = SessionAPI(),
        feedFetcherFactory: @escaping (String) -> any FeedFetching = { FeedService(baseURL: $0) },
        searchFetcherFactory: @escaping (String) -> SearchPostsService = { SearchPostsService(baseURL: $0) }
    ) {
        self.credentialStore = credentialStore
        self.api = api
        self.feedFetcherFactory = feedFetcherFactory
        self.searchFetcherFactory = searchFetcherFactory
    }

    func restoreSession() async {
        guard !hasStartedRestoration else { return }
        hasStartedRestoration = true
        phase = .restoring
        message = nil

        do {
            guard let storedTokens = try credentialStore.load() else {
                phase = .signedOut
                return
            }
            let rotatedTokens = try await api.refresh(refreshToken: storedTokens.refreshToken)
            try credentialStore.save(rotatedTokens)
            let restoredUser = try await api.currentUser(accessToken: rotatedTokens.accessToken)
            user = restoredUser
            phase = .signedIn
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
        } catch {
            phase = .restoreUnavailable
            message = "Couldn’t restore your session. Check your connection and try again."
            hasStartedRestoration = false
        }
    }

    func signIn(identifier: String, password: String) async {
        guard !isWorking else { return }
        message = SignInValidation.message(identifier: identifier, password: password)
        guard message == nil else { return }

        isWorking = true
        defer { isWorking = false }
        do {
            let result = try await api.signIn(
                identifier: identifier.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            try credentialStore.save(result.tokens)
            user = result.user
            phase = .signedIn
            message = nil
        } catch {
            message = error.localizedDescription
        }
    }

    func signOut() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }

        do {
            if let tokens = try credentialStore.load() {
                try await api.signOut(accessToken: tokens.accessToken)
            }
        } catch {
            // Revoke is best-effort; local credentials are still deleted below.
        }

        user = nil
        do {
            try credentialStore.clear()
            phase = .signedOut
            message = nil
        } catch {
            phase = .restoreUnavailable
            message = "Couldn’t securely remove this device’s saved session. Please try signing out again."
        }
    }

    func useAnotherAccount() async {
        do {
            try credentialStore.clear()
            user = nil
            phase = .signedOut
            message = nil
        } catch {
            message = "Couldn’t securely remove this device’s saved session. Please try again."
        }
    }

    func fetchMyProfile() async throws -> MyProfile {
        try await withCurrentProfileSession { token in
            try await api.fetchMyProfile(accessToken: token)
        }
    }

    func updateMyProfile(_ update: MyProfileUpdate) async throws -> MyProfile {
        try await withCurrentProfileSession { token in
            try await api.updateMyProfile(update, accessToken: token)
        }
    }

    private func withCurrentProfileSession<Value>(
        _ operation: (String) async throws -> Value
    ) async throws -> Value {
        let requestPhase = phase
        guard requestPhase == .signedIn else { throw SessionActionError.signInRequired }
        let requestUserID = user?.id
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequired
        }

        do {
            let result = try await operation(tokens.accessToken)
            try validateProfileSession(phase: requestPhase, userID: requestUserID, tokens: tokens)
            return result
        } catch let error as SessionAPIError where error.statusCode == 401 {
            rejectProfileSessionIfCurrent(phase: requestPhase, userID: requestUserID, tokens: tokens)
            throw error
        }
    }

    func fetchCommentProfiles() async throws -> [ManagedCommentProfile] {
        guard phase == .signedIn, let requestedUserID = user?.id else { throw SessionActionError.signInRequired }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequired
        }
        do {
            let page = try await api.fetchCommentProfiles(accessToken: tokens.accessToken)
            guard phase == .signedIn, user?.id == requestedUserID,
                  try credentialStore.load()?.accessToken == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            return page.data.filter(\.isEligibleForCommenting)
        } catch let error as SessionAPIError where error.statusCode == 401 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func submitReply(postID: String, text: String, parentCommentID: String? = nil, asProfileID: String? = nil) async throws -> ThreadComment {
        guard phase == .signedIn else { throw SessionActionError.signInRequired }
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty, trimmedText.count <= 1500 else { throw SessionActionError.invalidComment }
        guard !isWorking else { throw SessionActionError.requestInProgress }
        isWorking = true
        defer { isWorking = false }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequired
        }
        let trimmedProfileID = asProfileID?.trimmingCharacters(in: .whitespacesAndNewlines)
        return try await api.createComment(
            postID: postID,
            text: trimmedText,
            parentCommentID: parentCommentID,
            asProfileID: trimmedProfileID?.isEmpty == false ? trimmedProfileID : nil,
            accessToken: tokens.accessToken
        )
    }

    func submitTextPost(text: String, idempotencyKey: String) async throws -> String {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForPost }
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard TextPostValidation.error(for: trimmedText) == nil else { throw SessionActionError.invalidPostText }
        guard !isPostActionInProgress else { throw SessionActionError.requestInProgress }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForPost
        }

        isPostActionInProgress = true
        defer { isPostActionInProgress = false }
        do {
            return try await api.createTextPost(text: trimmedText, accessToken: tokens.accessToken, idempotencyKey: idempotencyKey)
        } catch let error as SessionAPIError where error.statusCode == 401 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchPost(postID: String) async throws -> ThreadPost {
        try await performAuthenticatedPostAction { token in
            try await api.fetchPost(postID: postID, accessToken: token)
        }
    }

    func fetchSavedPosts(cursor: String? = nil) async throws -> SavedPostsPage {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForPostAction }
        let requestedUserID = user?.id
        let tokens: SessionTokens?
        do {
            tokens = try credentialStore.load()
        } catch {
            user = nil
            phase = .restoreUnavailable
            hasStartedRestoration = false
            throw SessionActionError.signInRequiredForPostAction
        }
        guard let tokens else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForPostAction
        }

        do {
            let page = try await api.fetchSavedPosts(cursor: cursor, accessToken: tokens.accessToken)
            guard phase == .signedIn,
                  user?.id == requestedUserID,
                  try credentialStore.load()?.accessToken == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            return page
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            guard phase == .signedIn,
                  user?.id == requestedUserID,
                  (try? credentialStore.load()?.accessToken) == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchFeed(baseURL: String, kind: FeedKind, cursor: String? = nil) async throws -> FeedPage {
        if kind.requiresAuthentication, phase != .signedIn {
            throw FeedServiceError.authenticationRequired
        }

        var accessToken: String?
        let requestPhase = phase
        let requestUserID = user?.id
        if phase == .signedIn {
            guard let tokens = try credentialStore.load() else {
                user = nil
                phase = .signedOut
                if kind.requiresAuthentication {
                    throw FeedServiceError.authenticationRequired
                }
                return try await feedFetcherFactory(baseURL).fetch(feed: .forYou, cursor: cursor, accessToken: nil)
            }
            accessToken = tokens.accessToken
        }

        do {
            let page = try await feedFetcherFactory(baseURL).fetch(feed: kind, cursor: cursor, accessToken: accessToken)
            guard phase == requestPhase, user?.id == requestUserID else {
                throw SessionActionError.sessionChanged
            }
            if let accessToken {
                guard try credentialStore.load()?.accessToken == accessToken else {
                    throw SessionActionError.sessionChanged
                }
            }
            return page
        } catch let error as FeedServiceError where error.statusCode == 401 {
            if let accessToken {
                guard phase == requestPhase, user?.id == requestUserID else {
                    throw SessionActionError.sessionChanged
                }
                let currentAccessToken = try? credentialStore.load()?.accessToken
                guard currentAccessToken == accessToken else {
                    if currentAccessToken == nil {
                        clearAfterRejectedSession()
                        message = "Your session expired. Please sign in again."
                        throw error
                    }
                    throw SessionActionError.sessionChanged
                }
                clearAfterRejectedSession()
                message = "Your session expired. Please sign in again."
            }
            throw error
        }
    }

    func searchPosts(baseURL: String, query: String, cursor: String? = nil) async throws -> SearchPostsPage {
        let requestPhase = phase
        let requestUserID = user?.id
        var accessToken: String?
        if phase == .signedIn {
            guard let tokens = try credentialStore.load() else {
                user = nil
                phase = .signedOut
                throw SessionActionError.sessionChanged
            }
            accessToken = tokens.accessToken
        }

        do {
            let page = try await searchFetcherFactory(baseURL).search(query: query, cursor: cursor, accessToken: accessToken)
            guard phase == requestPhase, user?.id == requestUserID else { throw SessionActionError.sessionChanged }
            if let accessToken, try credentialStore.load()?.accessToken != accessToken { throw SessionActionError.sessionChanged }
            return page
        } catch let error as SearchAPIError where error.statusCode == 401 && accessToken != nil {
            guard phase == requestPhase, user?.id == requestUserID,
                  (try? credentialStore.load()?.accessToken) == accessToken else { throw SessionActionError.sessionChanged }
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchPublicProfile(userID: String, baseURL: String) async throws -> PublicProfileLoadResult {
        let requestPhase = phase
        guard requestPhase != .restoring else { throw PublicProfileAPIError.sessionChanged }
        let requestUserID = user?.id
        let isSignedIn = requestPhase == .signedIn
        let tokens: SessionTokens?
        if isSignedIn {
            guard let storedTokens = try credentialStore.load() else {
                user = nil
                phase = .signedOut
                throw PublicProfileAPIError.signInRequired
            }
            tokens = storedTokens
        } else {
            tokens = nil
        }

        do {
            let result = try await PublicProfileRepository(baseURL: baseURL, credentials: credentialStore)
                .load(userID: userID, isSignedIn: isSignedIn, viewerID: requestUserID)
            try validateProfileSession(phase: requestPhase, userID: requestUserID, tokens: tokens)
            return result
        } catch let error as PublicProfileAPIError where error.statusCode == 401 {
            rejectProfileSessionIfCurrent(phase: requestPhase, userID: requestUserID, tokens: tokens)
            throw error
        } catch {
            throw error
        }
    }

    func fetchMorePublicPosts(userID: String, cursor: String, baseURL: String) async throws -> PublicProfilePostsPage {
        let requestPhase = phase
        guard requestPhase != .restoring else { throw PublicProfileAPIError.sessionChanged }
        let requestUserID = user?.id
        let isSignedIn = requestPhase == .signedIn
        let tokens: SessionTokens?
        if isSignedIn {
            guard let storedTokens = try credentialStore.load() else {
                user = nil
                phase = .signedOut
                throw PublicProfileAPIError.signInRequired
            }
            tokens = storedTokens
        } else {
            tokens = nil
        }

        do {
            let page = try await PublicProfileRepository(baseURL: baseURL, credentials: credentialStore)
                .loadMore(userID: userID, cursor: cursor, isSignedIn: isSignedIn)
            try validateProfileSession(phase: requestPhase, userID: requestUserID, tokens: tokens)
            return page
        } catch let error as PublicProfileAPIError where error.statusCode == 401 {
            rejectProfileSessionIfCurrent(phase: requestPhase, userID: requestUserID, tokens: tokens)
            throw error
        } catch {
            throw error
        }
    }

    func setPublicFollowState(userID: String, shouldFollow: Bool, baseURL: String) async throws -> PublicFollowStatus {
        let requestPhase = phase
        guard requestPhase == .signedIn else { throw PublicProfileAPIError.signInRequired }
        let requestUserID = user?.id
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw PublicProfileAPIError.signInRequired
        }

        do {
            let result = try await PublicProfileRepository(baseURL: baseURL, credentials: credentialStore)
                .setFollow(userID: userID, shouldFollow: shouldFollow, isSignedIn: true)
            try validateProfileSession(phase: requestPhase, userID: requestUserID, tokens: tokens)
            return result
        } catch let error as PublicProfileAPIError where error.statusCode == 401 {
            rejectProfileSessionIfCurrent(phase: requestPhase, userID: requestUserID, tokens: tokens)
            throw error
        } catch {
            throw error
        }
    }

    private func validateProfileSession(phase requestPhase: SessionPhase, userID requestUserID: String?, tokens: SessionTokens?) throws {
        guard phase == requestPhase, user?.id == requestUserID else { throw SessionActionError.sessionChanged }
        if let tokens, try credentialStore.load()?.accessToken != tokens.accessToken {
            throw SessionActionError.sessionChanged
        }
    }

    private func rejectProfileSessionIfCurrent(phase requestPhase: SessionPhase, userID requestUserID: String?, tokens: SessionTokens?) {
        guard let tokens,
              phase == requestPhase,
              user?.id == requestUserID,
              (try? credentialStore.load()?.accessToken) == tokens.accessToken else { return }
        clearAfterRejectedSession()
        message = "Your session expired. Please sign in again."
    }

    func setPostLiked(postID: String, liked: Bool) async throws {
        try await performAuthenticatedPostAction { token in
            try await api.setPostLiked(postID: postID, liked: liked, accessToken: token)
        }
    }

    func setPostReposted(postID: String, reposted: Bool) async throws {
        try await performAuthenticatedPostAction { token in
            try await api.setPostReposted(postID: postID, reposted: reposted, accessToken: token)
        }
    }

    func setPostSaved(postID: String, saved: Bool) async throws {
        try await performAuthenticatedPostAction { token in
            try await api.setPostSaved(postID: postID, saved: saved, accessToken: token)
        }
    }

    func recordPostShare(postID: String) async throws {
        let requestPhase = phase
        let requestUserID = user?.id
        let accessToken: String?
        if requestPhase == .signedIn {
            guard let tokens = try credentialStore.load() else {
                user = nil
                phase = .signedOut
                try await api.recordPostShare(postID: postID, accessToken: nil)
                return
            }
            accessToken = tokens.accessToken
        } else {
            guard requestPhase == .signedOut else { throw SessionActionError.sessionChanged }
            accessToken = nil
        }

        do {
            try await api.recordPostShare(postID: postID, accessToken: accessToken)
            guard phase == requestPhase, user?.id == requestUserID else { throw SessionActionError.sessionChanged }
            if let accessToken, try credentialStore.load()?.accessToken != accessToken {
                throw SessionActionError.sessionChanged
            }
        } catch let error as SessionAPIError where error.statusCode == 401 && accessToken != nil {
            guard phase == requestPhase, user?.id == requestUserID,
                  (try? credentialStore.load()?.accessToken) == accessToken else {
                throw SessionActionError.sessionChanged
            }
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func recordPostLinkClick(postID: String) async {
        guard phase == .signedIn, let tokens = try? credentialStore.load() else { return }
        do {
            try await api.recordFeedInteraction(.postDetailLinkClick(postID: postID), accessToken: tokens.accessToken)
        } catch {
            // Link analytics are best-effort and must not interrupt opening the destination.
        }
    }

    func fetchWalletSummary() async throws -> WalletSummary {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForWallet }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForWallet
        }

        do {
            return try await api.fetchWalletSummary(accessToken: tokens.accessToken)
        } catch let error as SessionAPIError where error.statusCode == 401 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchWalletTransactions(cursor: String?) async throws -> WalletTransactionsPage {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForWallet }
        let storedTokens: SessionTokens?
        do {
            storedTokens = try credentialStore.load()
        } catch {
            user = nil
            phase = .restoreUnavailable
            hasStartedRestoration = false
            throw SessionActionError.signInRequiredForWallet
        }
        guard let tokens = storedTokens else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForWallet
        }
        let requestedUserID = user?.id

        do {
            let page = try await api.fetchWalletTransactions(accessToken: tokens.accessToken, cursor: cursor)
            guard phase == .signedIn,
                  user?.id == requestedUserID,
                  try credentialStore.load()?.accessToken == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            return page
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            guard phase == .signedIn,
                  user?.id == requestedUserID,
                  (try? credentialStore.load()?.accessToken) == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchOrdersWidget() async throws -> OrdersWidgetAPIResponse {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForOrders }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForOrders
        }
        let requestedUserID = user?.id

        do {
            let response = try await api.fetchOrdersWidget(accessToken: tokens.accessToken)
            guard phase == .signedIn,
                  user?.id == requestedUserID,
                  try credentialStore.load()?.accessToken == tokens.accessToken else {
                throw SessionActionError.sessionChanged
            }
            return response
        } catch let error as SessionAPIError where error.statusCode == 401 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    func fetchNotifications(filter: NotificationFilter, cursor: String? = nil) async throws -> NotificationsPage {
        let tokens = try notificationSessionTokens()
        let requestedUserID = user?.id
        do {
            let page = try await api.fetchNotifications(filter: filter, cursor: cursor, accessToken: tokens.accessToken)
            try validateNotificationSession(tokens: tokens, userID: requestedUserID)
            return page
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            try rejectNotificationSession(tokens: tokens, userID: requestedUserID)
            throw error
        }
    }

    func fetchConversationInbox(cursor: String? = nil) async throws -> ConversationInboxPage {
        let tokens = try conversationInboxSessionTokens()
        let requestedUserID = user?.id
        do {
            let page = try await api.fetchConversationInbox(accessToken: tokens.accessToken, cursor: cursor)
            try validateConversationInboxSession(tokens: tokens, userID: requestedUserID)
            return page
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            try rejectConversationInboxSession(tokens: tokens, userID: requestedUserID)
            throw error
        }
    }

    func markNotificationRead(id: String) async throws {
        let tokens = try notificationSessionTokens()
        let requestedUserID = user?.id
        do {
            try await api.markNotificationRead(id: id, accessToken: tokens.accessToken)
            try validateNotificationSession(tokens: tokens, userID: requestedUserID)
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            try rejectNotificationSession(tokens: tokens, userID: requestedUserID)
            throw error
        }
    }

    func markAllNotificationsRead() async throws {
        let tokens = try notificationSessionTokens()
        let requestedUserID = user?.id
        do {
            try await api.markAllNotificationsRead(accessToken: tokens.accessToken)
            try validateNotificationSession(tokens: tokens, userID: requestedUserID)
        } catch let error as SessionAPIError where error.statusCode == 401 || error.statusCode == 403 {
            try rejectNotificationSession(tokens: tokens, userID: requestedUserID)
            throw error
        }
    }

    private func notificationSessionTokens() throws -> SessionTokens {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForNotifications }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForNotifications
        }
        return tokens
    }

    private func conversationInboxSessionTokens() throws -> SessionTokens {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForInbox }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForInbox
        }
        return tokens
    }

    private func validateConversationInboxSession(tokens: SessionTokens, userID: String?) throws {
        guard phase == .signedIn, user?.id == userID,
              try credentialStore.load()?.accessToken == tokens.accessToken else {
            throw SessionActionError.sessionChanged
        }
    }

    private func rejectConversationInboxSession(tokens: SessionTokens, userID: String?) throws {
        guard phase == .signedIn, user?.id == userID,
              try credentialStore.load()?.accessToken == tokens.accessToken else {
            throw SessionActionError.sessionChanged
        }
        clearAfterRejectedSession()
        message = "Your session expired. Please sign in again."
    }

    private func validateNotificationSession(tokens: SessionTokens, userID: String?) throws {
        guard phase == .signedIn, user?.id == userID,
              try credentialStore.load()?.accessToken == tokens.accessToken else {
            throw SessionActionError.sessionChanged
        }
    }

    private func rejectNotificationSession(tokens: SessionTokens, userID: String?) throws {
        guard phase == .signedIn, user?.id == userID,
              try credentialStore.load()?.accessToken == tokens.accessToken else {
            throw SessionActionError.sessionChanged
        }
        clearAfterRejectedSession()
        message = "Your session expired. Please sign in again."
    }

    private func performAuthenticatedPostAction<Value>(
        _ operation: (String) async throws -> Value
    ) async throws -> Value {
        guard phase == .signedIn else { throw SessionActionError.signInRequiredForPostAction }
        guard !isPostActionInProgress else { throw SessionActionError.requestInProgress }
        guard let tokens = try credentialStore.load() else {
            user = nil
            phase = .signedOut
            throw SessionActionError.signInRequiredForPostAction
        }

        isPostActionInProgress = true
        defer { isPostActionInProgress = false }
        do {
            return try await operation(tokens.accessToken)
        } catch let error as SessionAPIError where error.statusCode == 401 {
            clearAfterRejectedSession()
            message = "Your session expired. Please sign in again."
            throw error
        }
    }

    private func clearAfterRejectedSession() {
        user = nil
        do {
            try credentialStore.clear()
            phase = .signedOut
        } catch {
            phase = .restoreUnavailable
            hasStartedRestoration = false
        }
    }
}

enum SessionActionError: LocalizedError {
    case signInRequired
    case signInRequiredForPostAction
    case signInRequiredForPost
    case signInRequiredForWallet
    case signInRequiredForOrders
    case signInRequiredForNotifications
    case signInRequiredForInbox
    case sessionChanged
    case invalidComment
    case invalidPostText
    case requestInProgress

    var errorDescription: String? {
        switch self {
        case .signInRequired: return "Sign in to reply to this post."
        case .signInRequiredForPostAction: return "Sign in to like or repost this post."
        case .invalidComment: return "Replies must contain 1–1,500 characters."
        case .signInRequiredForPost: return "Sign in to create a post."
        case .signInRequiredForWallet: return "Sign in to view your wallet."
        case .signInRequiredForOrders: return "Sign in to view your orders."
        case .signInRequiredForNotifications: return "Sign in to view your notifications."
        case .signInRequiredForInbox: return "Sign in to view your conversations."
        case .sessionChanged: return "Your account changed. Open Nantty to refresh this widget."
        case .invalidPostText: return "A post must contain 1–2,200 characters."
        case .requestInProgress: return "Another account request is still in progress. Please try again."
        }
    }
}
