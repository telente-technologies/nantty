import Foundation

protocol FeedFetching {
    func fetch(feed: FeedKind, cursor: String?, accessToken: String?) async throws -> FeedPage
}

struct FeedPost: Decodable, Identifiable {
    struct Author: Decodable {
        let id: String?
        let name: String
        let username: String
        let avatarUrl: URL?
        let verified: Bool
        let verification: Verification?

        struct Verification: Decodable {
            let status: String
            let color: String
            let tier: String
            let badgeVisible: Bool
        }

        var visibleBadgeColor: String? {
            if let verification {
                guard verification.badgeVisible,
                      verification.status == "active",
                      verification.tier != "ESSENTIAL",
                      ["blue", "gold", "black"].contains(verification.color) else {
                    return nil
                }
                return verification.color
            }
            return verified ? "blue" : nil
        }
    }

    struct Media: Decodable, Identifiable {
        let id: String
        let type: String
        let url: URL?
        let posterUrl: URL?
        let status: String

        var previewUrl: URL? {
            guard status == "ready" else { return nil }
            return type == "video" ? posterUrl : url
        }
    }

    struct PostedAs: Decodable {
        let name: String
        let handle: String
        let avatarUrl: URL?
    }

    let id: String
    let author: Author
    let postedAs: PostedAs?
    let createdAt: String
    let text: String
    let media: [Media]
    let likes: Int
    let liked: Bool?
    let bookmarked: Bool?
    let comments: Int
    let reposts: Int
    let reposted: Bool?
    let shares: Int

    var authorName: String { author.name }
    var username: String { author.username }
    var displayName: String { postedAs?.name ?? author.name }
    var displayHandle: String { postedAs?.handle ?? author.username }
    var displayAvatarUrl: URL? { postedAs?.avatarUrl ?? author.avatarUrl }
}

struct FeedPage: Decodable {
    let data: [FeedPost]
    let nextCursor: String?

    static func appending(_ incoming: [FeedPost], to current: [FeedPost]) -> [FeedPost] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}

enum FeedKind: String, CaseIterable, Identifiable {
    case forYou
    case following

    var id: String { rawValue }
    var title: String { self == .forYou ? "For You" : "Following" }
    var requiresAuthentication: Bool { self == .following }
    var path: String { "/api/v1/feeds/\(self == .forYou ? "for-you" : "following")" }
}

enum FeedServiceError: LocalizedError {
    case invalidBaseURL
    case authenticationRequired
    case httpStatus(Int)
    case unreadableResponse

    var statusCode: Int? {
        if case let .httpStatus(status) = self { return status }
        return nil
    }

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Set a valid backend URL in Settings to load the feed."
        case .authenticationRequired:
            return "Sign in to view posts from people you follow."
        case .httpStatus(let status):
            return "The feed request failed (HTTP \(status)). Please try again."
        case .unreadableResponse:
            return "Nantty returned a feed that could not be read. Please try again."
        }
    }
}

struct FeedService: FeedFetching {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetch(feed: FeedKind, cursor: String? = nil, accessToken: String? = nil) async throws -> FeedPage {
        if feed.requiresAuthentication, accessToken?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
            throw FeedServiceError.authenticationRequired
        }
        let url = try Self.url(baseURL: baseURL, feed: feed, cursor: cursor)

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw FeedServiceError.unreadableResponse }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw FeedServiceError.httpStatus(httpResponse.statusCode)
        }
        do {
            return try JSONDecoder().decode(FeedPage.self, from: data)
        } catch {
            throw FeedServiceError.unreadableResponse
        }
    }

    static func url(baseURL: String, feed: FeedKind = .forYou, cursor: String?) throws -> URL {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else {
            throw FeedServiceError.invalidBaseURL
        }

        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, feed.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }.joined(separator: "/")
        if let cursor {
            components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "cursor", value: cursor)]
        }
        guard let url = components.url else { throw FeedServiceError.invalidBaseURL }
        return url
    }
}
