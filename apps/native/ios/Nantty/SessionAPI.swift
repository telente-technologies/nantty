import Foundation

protocol SessionServicing {
    func signIn(identifier: String, password: String) async throws -> AuthSession
    func refresh(refreshToken: String) async throws -> SessionTokens
    func currentUser(accessToken: String) async throws -> SessionUser
    func fetchMyProfile(accessToken: String) async throws -> MyProfile
    func updateMyProfile(_ update: MyProfileUpdate, accessToken: String) async throws -> MyProfile
    func signOut(accessToken: String) async throws
    func fetchPost(postID: String, accessToken: String) async throws -> ThreadPost
    func fetchSavedPosts(cursor: String?, accessToken: String) async throws -> SavedPostsPage
    func fetchCommentProfiles(accessToken: String) async throws -> ManagedCommentProfilesPage
    func setPostLiked(postID: String, liked: Bool, accessToken: String) async throws
    func setPostReposted(postID: String, reposted: Bool, accessToken: String) async throws
    func setPostSaved(postID: String, saved: Bool, accessToken: String) async throws
    func recordPostShare(postID: String, accessToken: String?) async throws
    func recordFeedInteraction(_ interaction: FeedInteraction, accessToken: String) async throws
    func createComment(postID: String, text: String, parentCommentID: String?, asProfileID: String?, accessToken: String) async throws -> ThreadComment
    func createTextPost(text: String, accessToken: String, idempotencyKey: String) async throws -> String
    func fetchWalletSummary(accessToken: String) async throws -> WalletSummary
    func fetchWalletTransactions(accessToken: String, cursor: String?) async throws -> WalletTransactionsPage
    func fetchWalletEscrowHolds(accessToken: String) async throws -> WalletEscrowHoldsPage
    func fetchConversationInbox(accessToken: String, cursor: String?) async throws -> ConversationInboxPage
    func fetchOrdersWidget(accessToken: String) async throws -> OrdersWidgetAPIResponse
    func fetchBuyerOrders(filter: BuyerOrderFilter, cursor: String?, accessToken: String) async throws -> BuyerOrdersPage
    func fetchBuyerOrder(orderID: String, accessToken: String) async throws -> BuyerOrderDetail
    func fetchNotifications(filter: NotificationFilter, cursor: String?, accessToken: String) async throws -> NotificationsPage
    func markNotificationRead(id: String, accessToken: String) async throws
    func markAllNotificationsRead(accessToken: String) async throws
}

enum SessionAPIError: LocalizedError {
    case invalidBaseURL
    case invalidResponse
    case unsupportedOperation
    case httpStatus(Int, String?)

    var statusCode: Int? {
        if case let .httpStatus(status, _) = self { return status }
        return nil
    }

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Set a valid HTTPS backend URL in Settings. HTTP is allowed only for localhost development."
        case .invalidResponse:
            return "Nantty returned a response that could not be read. Please try again."
        case .unsupportedOperation:
            return "This profile action is unavailable. Please update Nantty and try again."
        case let .httpStatus(_, message):
            return message ?? "The request failed. Check your connection and try again."
        }
    }
}

extension SessionServicing {
    func recordPostShare(postID: String, accessToken: String?) async throws {
        throw SessionAPIError.unsupportedOperation
    }

    func recordFeedInteraction(_ interaction: FeedInteraction, accessToken: String) async throws {
        throw SessionAPIError.unsupportedOperation
    }

    func fetchMyProfile(accessToken: String) async throws -> MyProfile {
        throw SessionAPIError.unsupportedOperation
    }

    func fetchWalletEscrowHolds(accessToken: String) async throws -> WalletEscrowHoldsPage {
        throw SessionAPIError.unsupportedOperation
    }

    func updateMyProfile(_ update: MyProfileUpdate, accessToken: String) async throws -> MyProfile {
        throw SessionAPIError.unsupportedOperation
    }

    func fetchBuyerOrders(filter: BuyerOrderFilter, cursor: String?, accessToken: String) async throws -> BuyerOrdersPage {
        throw SessionAPIError.unsupportedOperation
    }

    func fetchBuyerOrder(orderID: String, accessToken: String) async throws -> BuyerOrderDetail {
        throw SessionAPIError.unsupportedOperation
    }
}

struct SessionAPI: SessionServicing {
    private let baseURLProvider: () -> String
    private let session: URLSession

    init(
        session: URLSession = .shared,
        baseURLProvider: (() -> String)? = nil
    ) {
        self.session = session
        self.baseURLProvider = baseURLProvider ?? { Self.configuredBaseURL() }
    }

    func signIn(identifier: String, password: String) async throws -> AuthSession {
        try await send(
            path: "/api/v1/auth/login",
            method: "POST",
            body: LoginRequest(identifier: identifier, password: password),
            response: AuthSession.self
        )
    }

    func refresh(refreshToken: String) async throws -> SessionTokens {
        try await send(
            path: "/api/v1/auth/refresh",
            method: "POST",
            body: RefreshRequest(refreshToken: refreshToken),
            response: SessionTokens.self
        )
    }

    func currentUser(accessToken: String) async throws -> SessionUser {
        try await send(path: "/api/v1/users/me", method: "GET", bearerToken: accessToken, response: SessionUser.self)
    }

    func fetchMyProfile(accessToken: String) async throws -> MyProfile {
        try await sendWithoutBody(path: "/api/v1/users/me", method: "GET", bearerToken: accessToken, response: MyProfile.self)
    }

    func updateMyProfile(_ update: MyProfileUpdate, accessToken: String) async throws -> MyProfile {
        try await send(path: "/api/v1/users/me", method: "PATCH", body: update, bearerToken: accessToken, response: MyProfile.self)
    }

    func signOut(accessToken: String) async throws {
        let _: EmptyResponse = try await sendWithoutBody(
            path: "/api/v1/auth/logout",
            method: "POST",
            bearerToken: accessToken,
            response: EmptyResponse.self
        )
    }

    func fetchPost(postID: String, accessToken: String) async throws -> ThreadPost {
        guard !PostThreadService.pathSegment(postID).isEmpty else { throw SessionAPIError.invalidBaseURL }
        return try await sendWithoutBody(
            path: "/api/v1/posts/\(PostThreadService.pathSegment(postID))",
            method: "GET",
            bearerToken: accessToken,
            response: ThreadPost.self
        )
    }

    func fetchSavedPosts(cursor: String?, accessToken: String) async throws -> SavedPostsPage {
        var queryItems = [URLQueryItem(name: "type", value: "post")]
        if let cursor { queryItems.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await sendWithoutBody(
            path: "/api/v1/saves",
            method: "GET",
            queryItems: queryItems,
            bearerToken: accessToken,
            response: SavedPostsPage.self
        )
    }

    func fetchCommentProfiles(accessToken: String) async throws -> ManagedCommentProfilesPage {
        try await sendWithoutBody(
            path: "/api/v1/users/me/profiles",
            method: "GET",
            bearerToken: accessToken,
            response: ManagedCommentProfilesPage.self
        )
    }

    func setPostLiked(postID: String, liked: Bool, accessToken: String) async throws {
        guard !PostThreadService.pathSegment(postID).isEmpty else { throw SessionAPIError.invalidBaseURL }
        let _: EmptyResponse = try await sendWithoutBody(
            path: "/api/v1/posts/\(PostThreadService.pathSegment(postID))/like",
            method: liked ? "POST" : "DELETE",
            bearerToken: accessToken,
            response: EmptyResponse.self
        )
    }

    func setPostReposted(postID: String, reposted: Bool, accessToken: String) async throws {
        guard !PostThreadService.pathSegment(postID).isEmpty else { throw SessionAPIError.invalidBaseURL }
        if reposted {
            let _: PostMutationResponse = try await send(
                path: "/api/v1/posts/\(PostThreadService.pathSegment(postID))/repost",
                method: "POST",
                body: EmptyJSONBody(),
                bearerToken: accessToken,
                response: PostMutationResponse.self
            )
        } else {
            let _: EmptyResponse = try await sendWithoutBody(
                path: "/api/v1/posts/\(PostThreadService.pathSegment(postID))/repost",
                method: "DELETE",
                bearerToken: accessToken,
                response: EmptyResponse.self
            )
        }
    }

    func setPostSaved(postID: String, saved: Bool, accessToken: String) async throws {
        let targetID = PostThreadService.pathSegment(postID)
        guard !targetID.isEmpty else { throw SessionAPIError.invalidBaseURL }
        if saved {
            let _: EmptyResponse = try await send(
                path: "/api/v1/saves",
                method: "POST",
                body: SavePostRequest(type: "post", targetId: postID),
                bearerToken: accessToken,
                response: EmptyResponse.self
            )
        } else {
            let _: EmptyResponse = try await sendWithoutBody(
                path: "/api/v1/saves",
                method: "DELETE",
                queryItems: [URLQueryItem(name: "type", value: "post"), URLQueryItem(name: "targetId", value: postID)],
                bearerToken: accessToken,
                response: EmptyResponse.self
            )
        }
    }

    func recordPostShare(postID: String, accessToken: String?) async throws {
        let safePostID = PostThreadService.pathSegment(postID)
        guard !safePostID.isEmpty, safePostID == postID else { throw SessionAPIError.invalidBaseURL }
        let _: EmptyResponse = try await send(
            path: "/api/v1/posts/\(safePostID)/share",
            method: "POST",
            body: RecordPostShareRequest(channel: "link"),
            bearerToken: accessToken,
            response: EmptyResponse.self
        )
    }

    func recordFeedInteraction(_ interaction: FeedInteraction, accessToken: String) async throws {
        let _: EmptyResponse = try await send(
            path: "/api/v1/feeds/interactions/batch",
            method: "POST",
            body: FeedInteractionBatch(events: [interaction]),
            bearerToken: accessToken,
            response: EmptyResponse.self
        )
    }

    func createComment(postID: String, text: String, parentCommentID: String?, asProfileID: String?, accessToken: String) async throws -> ThreadComment {
        guard !PostThreadService.pathSegment(postID).isEmpty else { throw SessionAPIError.invalidBaseURL }
        try await send(
            path: "/api/v1/posts/\(PostThreadService.pathSegment(postID))/comments",
            method: "POST",
            body: CreateThreadCommentRequest(text: text, parentCommentId: parentCommentID, asProfileId: asProfileID),
            bearerToken: accessToken,
            response: ThreadComment.self
        )
    }

    func createTextPost(text: String, accessToken: String, idempotencyKey: String) async throws -> String {
        let response: CreatedPostResponse = try await send(
            path: "/api/v1/posts",
            method: "POST",
            body: CreateTextPostRequest(text: text),
            bearerToken: accessToken,
            idempotencyKey: idempotencyKey,
            response: CreatedPostResponse.self
        )
        return response.id
    }

    func fetchWalletSummary(accessToken: String) async throws -> WalletSummary {
        try await sendWithoutBody(
            path: "/api/v1/wallets/me",
            method: "GET",
            bearerToken: accessToken,
            response: WalletSummary.self
        )
    }

    func fetchWalletTransactions(accessToken: String, cursor: String?) async throws -> WalletTransactionsPage {
        try await sendWithoutBody(
            path: "/api/v1/wallets/me/transactions",
            method: "GET",
            queryItems: cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [],
            bearerToken: accessToken,
            response: WalletTransactionsPage.self
        )
    }

    func fetchWalletEscrowHolds(accessToken: String) async throws -> WalletEscrowHoldsPage {
        try await sendWithoutBody(
            path: "/api/v1/wallets/me/escrow-holds",
            method: "GET",
            bearerToken: accessToken,
            response: WalletEscrowHoldsPage.self
        )
    }

    func fetchConversationInbox(accessToken: String, cursor: String?) async throws -> ConversationInboxPage {
        var query = [URLQueryItem(name: "folder", value: "chats"), URLQueryItem(name: "limit", value: "20")]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await sendWithoutBody(
            path: "/api/v1/conversations",
            method: "GET",
            queryItems: query,
            bearerToken: accessToken,
            response: ConversationInboxPage.self
        )
    }

    func fetchOrdersWidget(accessToken: String) async throws -> OrdersWidgetAPIResponse {
        try await sendWithoutBody(
            path: "/api/v1/widgets/orders",
            method: "GET",
            bearerToken: accessToken,
            response: OrdersWidgetAPIResponse.self
        )
    }

    func fetchBuyerOrders(filter: BuyerOrderFilter, cursor: String?, accessToken: String) async throws -> BuyerOrdersPage {
        let queryItems = [
            URLQueryItem(name: "limit", value: String(BuyerOrdersRequest.pageSize)),
            filter == .all ? nil : URLQueryItem(name: "status", value: filter.rawValue),
            cursor?.isEmpty == false ? URLQueryItem(name: "cursor", value: cursor) : nil,
        ].compactMap { $0 }
        return try await sendWithoutBody(
            path: "/api/v1/orders",
            method: "GET",
            queryItems: queryItems,
            bearerToken: accessToken,
            response: BuyerOrdersPage.self
        )
    }

    func fetchBuyerOrder(orderID: String, accessToken: String) async throws -> BuyerOrderDetail {
        guard let path = BuyerOrdersRequest.detailPath(orderID: orderID) else {
            throw SessionAPIError.invalidBaseURL
        }
        return try await sendWithoutBody(
            path: path,
            method: "GET",
            bearerToken: accessToken,
            response: BuyerOrderDetail.self
        )
    }

    func fetchNotifications(filter: NotificationFilter, cursor: String?, accessToken: String) async throws -> NotificationsPage {
        var query = [URLQueryItem(name: "filter", value: filter.rawValue)]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await sendWithoutBody(
            path: "/api/v1/notifications", method: "GET", queryItems: query,
            bearerToken: accessToken, response: NotificationsPage.self
        )
    }

    func markNotificationRead(id: String, accessToken: String) async throws {
        let segment = id.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")) ?? ""
        guard !segment.isEmpty else { throw SessionAPIError.invalidBaseURL }
        let _: EmptyResponse = try await sendWithoutBody(
            path: "/api/v1/notifications/\(segment)/read", method: "POST",
            bearerToken: accessToken, response: EmptyResponse.self
        )
    }

    func markAllNotificationsRead(accessToken: String) async throws {
        let _: EmptyResponse = try await sendWithoutBody(
            path: "/api/v1/notifications/read-all", method: "POST",
            bearerToken: accessToken, response: EmptyResponse.self
        )
    }

    private func send<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body,
        bearerToken: String? = nil,
        idempotencyKey: String? = nil,
        response: Response.Type
    ) async throws -> Response {
        let bodyData = try JSONEncoder().encode(body)
        return try await sendRequest(path: path, method: method, bodyData: bodyData, bearerToken: bearerToken, idempotencyKey: idempotencyKey, response: response)
    }

    private func sendWithoutBody<Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bearerToken: String? = nil,
        response: Response.Type
    ) async throws -> Response {
        try await sendRequest(path: path, method: method, queryItems: queryItems, bearerToken: bearerToken, response: response)
    }

    private func sendRequest<Response: Decodable>(
        path: String,
        method: String,
        bodyData: Data? = nil,
        queryItems: [URLQueryItem] = [],
        bearerToken: String? = nil,
        idempotencyKey: String? = nil,
        response: Response.Type
    ) async throws -> Response {
        guard let configuration = APIConfiguration(rawValue: baseURLProvider()),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else {
            throw SessionAPIError.invalidBaseURL
        }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }
            .joined(separator: "/")
        if !queryItems.isEmpty { components.queryItems = queryItems }
        guard let url = components.url else { throw SessionAPIError.invalidBaseURL }

        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if let bodyData {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = bodyData
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw SessionAPIError.invalidResponse }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let apiError = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw SessionAPIError.httpStatus(httpResponse.statusCode, apiError?.message)
        }
        if Response.self == EmptyResponse.self {
            if let emptyResponse = EmptyResponse() as? Response { return emptyResponse }
            throw SessionAPIError.invalidResponse
        }
        do {
            return try SessionPayloadDecoder.decode(response, from: data)
        } catch {
            throw SessionAPIError.invalidResponse
        }
    }

    private static func configuredBaseURL() -> String {
        UserDefaults.standard.string(forKey: "apiBaseURL")
            ?? Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String
            ?? "http://localhost:8080"
    }
}

private struct LoginRequest: Encodable {
    let identifier: String
    let password: String
}

private struct RefreshRequest: Encodable {
    let refreshToken: String
}

private struct EmptyJSONBody: Encodable {}

private struct SavePostRequest: Encodable {
    let type: String
    let targetId: String
}

private struct CreateTextPostRequest: Encodable {
    let text: String
    let kind = "post"
}

private struct RecordPostShareRequest: Encodable {
    let channel: String
}

private struct CreatedPostResponse: Decodable {
    let id: String
}

private struct PostMutationResponse: Decodable {
    let id: String
}

private struct APIErrorBody: Decodable {
    let message: String?
}

private struct EmptyResponse: Decodable {
    init() {}
}
