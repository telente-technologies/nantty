import Foundation

struct PublicProfile: Decodable, Equatable, Identifiable {
    struct Account: Decodable, Equatable {
        let status: String?
    }

    struct Verification: Decodable, Equatable {
        let status: String?
        let color: String?
        let tier: String?
        let badgeVisible: Bool?
    }

    let id: String
    let name: String
    let username: String
    let bio: String
    let avatarUrl: URL?
    let bannerUrl: URL?
    let verified: Bool
    let verification: Verification?
    let followers: Int
    let following: Int
    let posts: Int
    let joinedAt: String?
    let isPrivate: Bool?
    let isFollowing: Bool
    let followState: String?
    let account: Account?

    private enum CodingKeys: String, CodingKey {
        case id, name, username, bio, avatarUrl, bannerUrl, verified, verification
        case followers, following, posts, joinedAt, isPrivate, isFollowing, followState, account
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        username = try values.decode(String.self, forKey: .username)
        let decodedName = try values.decodeIfPresent(String.self, forKey: .name)
        name = decodedName.flatMap { $0.isEmpty ? nil : $0 } ?? username
        bio = try values.decodeIfPresent(String.self, forKey: .bio) ?? ""
        avatarUrl = try values.decodeIfPresent(URL.self, forKey: .avatarUrl)
        bannerUrl = try values.decodeIfPresent(URL.self, forKey: .bannerUrl)
        verified = try values.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        verification = try values.decodeIfPresent(Verification.self, forKey: .verification)
        followers = max(0, try values.decodeIfPresent(Int.self, forKey: .followers) ?? 0)
        following = max(0, try values.decodeIfPresent(Int.self, forKey: .following) ?? 0)
        posts = max(0, try values.decodeIfPresent(Int.self, forKey: .posts) ?? 0)
        joinedAt = try values.decodeIfPresent(String.self, forKey: .joinedAt)
        isPrivate = try values.decodeIfPresent(Bool.self, forKey: .isPrivate)
        isFollowing = try values.decodeIfPresent(Bool.self, forKey: .isFollowing) ?? false
        followState = try values.decodeIfPresent(String.self, forKey: .followState)
        account = try values.decodeIfPresent(Account.self, forKey: .account)
    }
}

struct PublicProfilePost: Decodable, Equatable, Identifiable {
    struct Media: Decodable, Equatable, Identifiable {
        let id: String
        let type: String
        let url: URL?
        let posterUrl: URL?
        let status: String

        var previewURL: URL? {
            guard status == "ready" else { return nil }
            let candidate = type == "video" ? (posterUrl ?? url) : url
            guard let candidate,
                  let scheme = candidate.scheme?.lowercased(),
                  let host = candidate.host?.lowercased(),
                  !host.isEmpty,
                  scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else {
                return nil
            }
            return candidate
        }
    }

    let id: String
    let text: String
    let createdAt: String?
    let media: [Media]
    let likes: Int
    let comments: Int
    let reposts: Int
    let views: Int

    private enum CodingKeys: String, CodingKey { case id, text, createdAt, media, likes, comments, reposts, views }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        text = try values.decodeIfPresent(String.self, forKey: .text) ?? ""
        createdAt = try values.decodeIfPresent(String.self, forKey: .createdAt)
        media = try values.decodeIfPresent([Media].self, forKey: .media) ?? []
        likes = max(0, try values.decodeIfPresent(Int.self, forKey: .likes) ?? 0)
        comments = max(0, try values.decodeIfPresent(Int.self, forKey: .comments) ?? 0)
        reposts = max(0, try values.decodeIfPresent(Int.self, forKey: .reposts) ?? 0)
        views = max(0, try values.decodeIfPresent(Int.self, forKey: .views) ?? 0)
    }
}

struct PublicFollowStatus: Decodable, Equatable {
    let state: String
}

struct PublicProfilePostsPage: Decodable, Equatable {
    let data: [PublicProfilePost]
    let nextCursor: String?

    static func appending(_ incoming: [PublicProfilePost], to current: [PublicProfilePost]) -> [PublicProfilePost] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}

struct PublicProfileLoadResult {
    let profile: PublicProfile
    let visibility: PublicProfileVisibility
    let followState: String
    let page: PublicProfilePostsPage?
}

enum PublicProfileVisibility: Equatable {
    case open
    case privateProfile
    case blocked
    case suspended

    static func resolve(profile: PublicProfile, followState: String?, isViewer: Bool = false) -> PublicProfileVisibility {
        if profile.account?.status == "suspended" { return .suspended }
        if followState == "blocked" { return .blocked }
        if isViewer { return .open }
        let state = followState ?? profile.followState ?? (profile.isFollowing ? "accepted" : "none")
        return profile.isPrivate != false && state != "accepted" ? .privateProfile : .open
    }
}

enum PublicProfileAPIError: LocalizedError {
    case invalidBaseURL
    case invalidUserID
    case httpStatus(Int)
    case unreadableResponse
    case sessionChanged
    case signInRequired

    var statusCode: Int? {
        if case let .httpStatus(status) = self { return status }
        return nil
    }

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL: return "Set a valid backend URL in Settings. HTTP is allowed only for localhost development."
        case .invalidUserID: return "This profile is unavailable."
        case .httpStatus(let status): return "The profile request failed (HTTP \(status)). Please try again."
        case .unreadableResponse: return "Nantty returned profile data that could not be read. Please try again."
        case .sessionChanged: return "Your account changed. Reload this profile to continue."
        case .signInRequired: return "Sign in again to load this profile."
        }
    }
}

struct PublicProfileAPI {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchProfile(userID: String, accessToken: String?) async throws -> PublicProfile {
        guard let safeUserID = Self.validatedUserID(userID) else { throw PublicProfileAPIError.invalidUserID }
        return try await get(path: "/api/v1/users/\(safeUserID)", accessToken: accessToken, response: PublicProfile.self)
    }

    func fetchFollowStatus(userID: String, accessToken: String) async throws -> PublicFollowStatus {
        guard let safeUserID = Self.validatedUserID(userID) else { throw PublicProfileAPIError.invalidUserID }
        return try await get(path: "/api/v1/users/\(safeUserID)/follow-status", accessToken: accessToken, response: PublicFollowStatus.self)
    }

    func setFollow(userID: String, shouldFollow: Bool, accessToken: String) async throws -> PublicFollowStatus {
        guard let safeUserID = Self.validatedUserID(userID) else { throw PublicProfileAPIError.invalidUserID }
        let path = "/api/v1/users/\(safeUserID)/follow"
        if !shouldFollow {
            try await send(path: path, method: "DELETE", accessToken: accessToken)
            return PublicFollowStatus(state: "none")
        }
        return try await send(path: path, method: "POST", accessToken: accessToken, body: Data("{}".utf8), response: PublicFollowStatus.self)
    }

    func fetchPublicPosts(userID: String, cursor: String?, accessToken: String?) async throws -> PublicProfilePostsPage {
        guard Self.validatedUserID(userID) != nil else { throw PublicProfileAPIError.invalidUserID }
        var query = [URLQueryItem(name: "visibility", value: "public")]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await get(
            path: "/api/v1/users/\(Self.pathSegment(userID))/posts",
            queryItems: query,
            accessToken: accessToken,
            response: PublicProfilePostsPage.self
        )
    }

    static func validatedUserID(_ value: String) -> String? {
        guard (1...128).contains(value.utf8.count),
              value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { return nil }
        return value
    }

    static func url(baseURL: String, path: String, queryItems: [URLQueryItem] = []) -> URL? {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else { return nil }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }.joined(separator: "/")
        if !queryItems.isEmpty { components.queryItems = queryItems }
        return components.url
    }

    private func get<Response: Decodable>(
        path: String,
        queryItems: [URLQueryItem] = [],
        accessToken: String?,
        response: Response.Type
    ) async throws -> Response {
        try await send(path: path, method: "GET", queryItems: queryItems, accessToken: accessToken, response: response)
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        accessToken: String?,
        body: Data? = nil,
        response: Response.Type
    ) async throws -> Response {
        guard let url = Self.url(baseURL: baseURL, path: path, queryItems: queryItems) else {
            throw PublicProfileAPIError.invalidBaseURL
        }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let accessToken, !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PublicProfileAPIError.unreadableResponse }
        guard (200..<300).contains(http.statusCode) else { throw PublicProfileAPIError.httpStatus(http.statusCode) }
        do { return try SessionPayloadDecoder.decode(Response.self, from: data) }
        catch { throw PublicProfileAPIError.unreadableResponse }
    }

    private func send(path: String, method: String, accessToken: String) async throws {
        guard let url = Self.url(baseURL: baseURL, path: path) else { throw PublicProfileAPIError.invalidBaseURL }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PublicProfileAPIError.unreadableResponse }
        guard (200..<300).contains(http.statusCode) else { throw PublicProfileAPIError.httpStatus(http.statusCode) }
    }
}

struct PublicProfileRepository {
    let api: PublicProfileAPI
    let credentials: SessionCredentialStoring

    init(baseURL: String, session: URLSession = .shared, credentials: SessionCredentialStoring = KeychainSessionCredentialStore()) {
        api = PublicProfileAPI(baseURL: baseURL, session: session)
        self.credentials = credentials
    }

    func load(userID: String, isSignedIn: Bool, viewerID: String? = nil) async throws -> PublicProfileLoadResult {
        guard let safeUserID = PublicProfileAPI.validatedUserID(userID) else { throw PublicProfileAPIError.invalidUserID }
        let tokens = try requestTokens(isSignedIn: isSignedIn)
        let profile = try await api.fetchProfile(userID: safeUserID, accessToken: tokens?.accessToken)
        try validateSession(tokens: tokens, isSignedIn: isSignedIn)

        var followState = tokens == nil ? "none" : (profile.followState ?? (profile.isFollowing ? "accepted" : nil))
        if let token = tokens?.accessToken {
            do {
                followState = try await api.fetchFollowStatus(userID: safeUserID, accessToken: token).state
                try validateSession(tokens: tokens, isSignedIn: isSignedIn)
            } catch let error as PublicProfileAPIError where error.statusCode == 401 {
                throw error
            } catch {
                followState = "unknown"
            }
        }

        let resolvedFollowState = followState ?? profile.followState ?? (profile.isFollowing ? "accepted" : "none")
        let visibility = PublicProfileVisibility.resolve(profile: profile, followState: resolvedFollowState, isViewer: viewerID == profile.id)
        guard visibility == .open else { return PublicProfileLoadResult(profile: profile, visibility: visibility, followState: resolvedFollowState, page: nil) }
        let page = try await api.fetchPublicPosts(userID: safeUserID, cursor: nil, accessToken: tokens?.accessToken)
        try validateSession(tokens: tokens, isSignedIn: isSignedIn)
        return PublicProfileLoadResult(profile: profile, visibility: visibility, followState: resolvedFollowState, page: page)
    }

    func loadMore(userID: String, cursor: String, isSignedIn: Bool) async throws -> PublicProfilePostsPage {
        guard let safeUserID = PublicProfileAPI.validatedUserID(userID), !cursor.isEmpty, cursor.utf8.count <= 512 else {
            throw PublicProfileAPIError.invalidUserID
        }
        let tokens = try requestTokens(isSignedIn: isSignedIn)
        let page = try await api.fetchPublicPosts(userID: safeUserID, cursor: cursor, accessToken: tokens?.accessToken)
        try validateSession(tokens: tokens, isSignedIn: isSignedIn)
        return page
    }

    func setFollow(userID: String, shouldFollow: Bool, isSignedIn: Bool) async throws -> PublicFollowStatus {
        guard let safeUserID = PublicProfileAPI.validatedUserID(userID) else { throw PublicProfileAPIError.invalidUserID }
        let tokens = try requestTokens(isSignedIn: isSignedIn)
        guard let tokens else { throw PublicProfileAPIError.signInRequired }
        let result = try await api.setFollow(userID: safeUserID, shouldFollow: shouldFollow, accessToken: tokens.accessToken)
        try validateSession(tokens: tokens, isSignedIn: isSignedIn)
        return result
    }

    private func requestTokens(isSignedIn: Bool) throws -> SessionTokens? {
        guard isSignedIn else { return nil }
        guard let tokens = try credentials.load() else { throw PublicProfileAPIError.signInRequired }
        return tokens
    }

    private func validateSession(tokens: SessionTokens?, isSignedIn: Bool) throws {
        guard isSignedIn else { return }
        guard let tokens, try credentials.load()?.accessToken == tokens.accessToken else {
            throw PublicProfileAPIError.sessionChanged
        }
    }
}
