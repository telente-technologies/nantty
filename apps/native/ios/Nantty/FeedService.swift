import Foundation

struct FeedPost: Decodable, Identifiable {
    struct Author: Decodable {
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
    let comments: Int
    let reposts: Int
    let shares: Int

    var authorName: String { author.name }
    var username: String { author.username }
    var displayName: String { postedAs?.name ?? author.name }
    var displayHandle: String { postedAs?.handle ?? author.username }
    var displayAvatarUrl: URL? { postedAs?.avatarUrl ?? author.avatarUrl }
}

private struct FeedPage: Decodable {
    let data: [FeedPost]
    let nextCursor: String?
}

enum FeedServiceError: LocalizedError {
    case invalidBaseURL
    case httpStatus(Int)
    case unreadableResponse

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Set a valid backend URL in Settings to load the feed."
        case .httpStatus(let status):
            return "The feed request failed (HTTP \(status)). Please try again."
        case .unreadableResponse:
            return "Nantty returned a feed that could not be read. Please try again."
        }
    }
}

struct FeedService {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchForYou() async throws -> [FeedPost] {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else {
            throw FeedServiceError.invalidBaseURL
        }

        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, "api/v1/feeds/for-you"].filter { !$0.isEmpty }.joined(separator: "/")
        guard let url = components.url else { throw FeedServiceError.invalidBaseURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw FeedServiceError.unreadableResponse }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw FeedServiceError.httpStatus(httpResponse.statusCode)
        }
        do {
            return try JSONDecoder().decode(FeedPage.self, from: data).data
        } catch {
            throw FeedServiceError.unreadableResponse
        }
    }
}
