import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct ThreadPost: Decodable, Identifiable {
    struct Author: Decodable {
        let name: String
        let username: String
        let avatarUrl: URL?
        let verified: Bool
    }

    struct Media: Decodable, Identifiable {
        let id: String
        let type: String
        let url: URL?
        let posterUrl: URL?
        let status: String

        var readyImageURL: URL? {
            guard type == "image", status == "ready" else { return nil }
            return url
        }
    }

    let id: String
    let author: Author
    let createdAt: String
    let text: String
    let media: [Media]
    let likes: Int
    let liked: Bool
    let bookmarked: Bool?
    let reposts: Int
    let reposted: Bool
}

struct ThreadVideoReply: Decodable, Identifiable {
    let clipId: String
    let thumbnailUrl: URL?
    let createdAt: String

    var id: String { clipId }

    var previewURL: URL? {
        guard let thumbnailUrl,
              let scheme = thumbnailUrl.scheme?.lowercased(),
              let host = thumbnailUrl.host?.lowercased(),
              !host.isEmpty else {
            return nil
        }
        guard scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return thumbnailUrl
    }
}

struct ThreadComment: Decodable, Identifiable {
    struct Media: Decodable, Identifiable {
        let id: String
        let type: String
        let url: URL?
        let posterUrl: URL?
        let status: String

        var previewURL: URL? {
            guard status == "ready" else { return nil }
            return type == "video" ? (posterUrl ?? url) : (type == "image" ? url : nil)
        }
    }

    struct Author: Decodable {
        let name: String
        let username: String
        let avatarUrl: URL?
        let verified: Bool
    }

    let id: String
    let postId: String
    let parentCommentId: String?
    let author: Author
    let text: String
    let createdAt: String
    let media: [Media]
    let videoReplies: [ThreadVideoReply]
    let inlineReplies: [ThreadComment]

    private enum CodingKeys: String, CodingKey {
        case id, postId, parentCommentId, author, text, createdAt, media, videoReplies, inlineReplies
    }

    init(id: String, postId: String, parentCommentId: String?, author: Author, text: String, createdAt: String, media: [Media] = [], videoReplies: [ThreadVideoReply] = [], inlineReplies: [ThreadComment] = []) {
        self.id = id
        self.postId = postId
        self.parentCommentId = parentCommentId
        self.author = author
        self.text = text
        self.createdAt = createdAt
        self.media = media
        self.videoReplies = videoReplies
        self.inlineReplies = inlineReplies
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        postId = try values.decode(String.self, forKey: .postId)
        parentCommentId = try values.decodeIfPresent(String.self, forKey: .parentCommentId)
        author = try values.decode(Author.self, forKey: .author)
        text = try values.decode(String.self, forKey: .text)
        createdAt = try values.decode(String.self, forKey: .createdAt)
        media = try values.decodeIfPresent([Media].self, forKey: .media) ?? []
        videoReplies = try values.decodeIfPresent([ThreadVideoReply].self, forKey: .videoReplies) ?? []
        inlineReplies = try values.decodeIfPresent([ThreadComment].self, forKey: .inlineReplies) ?? []
    }
}

struct ThreadCommentPage: Decodable {
    let data: [ThreadComment]
    let nextCursor: String?

    var usableNextCursor: String? {
        guard let nextCursor,
              !nextCursor.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return nextCursor
    }

    func continuing(after cursor: String, consumedCursors: Set<String>) -> ThreadCommentPage {
        let candidate = usableNextCursor
        return ThreadCommentPage(
            data: data,
            nextCursor: candidate == cursor || candidate.map(consumedCursors.contains) == true ? nil : candidate
        )
    }

    static func appending(_ incoming: [ThreadComment], to existing: [ThreadComment]) -> [ThreadComment] {
        var seen = Set(existing.map(\.id))
        return existing + incoming.filter { seen.insert($0.id).inserted }
    }
}

struct ManagedCommentProfile: Decodable, Identifiable, Equatable {
    let id: String
    let kind: String
    let name: String
    let handle: String
    let onHold: Bool?

    var isEligibleForCommenting: Bool {
        ["business", "brand", "store"].contains(kind)
            && onHold != true
            && !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !handle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    var displayKind: String { kind.capitalized }
}

struct ManagedCommentProfilesPage: Decodable {
    let data: [ManagedCommentProfile]
}

struct CreateThreadCommentRequest: Encodable, Equatable {
    let text: String
    let parentCommentId: String?
    let asProfileId: String?

    init(text: String, parentCommentId: String?, asProfileId: String? = nil) {
        self.text = text
        self.parentCommentId = parentCommentId
        self.asProfileId = asProfileId
    }
}

enum PostThreadAPIError: LocalizedError {
    case invalidBaseURL
    case httpStatus(Int)
    case unreadableResponse

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL: return "Set a valid backend URL in Settings to load this conversation."
        case .httpStatus(let status): return "The conversation request failed (HTTP \(status)). Please try again."
        case .unreadableResponse: return "Nantty returned a conversation that could not be read. Please try again."
        }
    }
}

struct PostThreadService {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchPost(id: String, accessToken: String? = nil) async throws -> ThreadPost {
        try await get(path: "/api/v1/posts/\(Self.pathSegment(id))", accessToken: accessToken, response: ThreadPost.self)
    }

    func fetchThread(postID: String, cursor: String? = nil) async throws -> ThreadCommentPage {
        try await get(path: Self.threadPath(postID: postID, cursor: cursor), response: ThreadCommentPage.self)
    }

    static func threadPath(postID: String, cursor: String? = nil) -> String {
        let base = "/api/v1/posts/\(pathSegment(postID))/thread?sort=relevant"
        guard let cursor, !cursor.isEmpty else { return base }
        let unreserved = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        let encodedCursor = cursor.addingPercentEncoding(withAllowedCharacters: unreserved) ?? ""
        return "\(base)&cursor=\(encodedCursor)"
    }

    static func pathSegment(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")) ?? ""
    }

    static func url(baseURL: String, path: String, queryItems: [URLQueryItem] = []) -> URL? {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else { return nil }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let pathParts = path.split(separator: "?", maxSplits: 1).map(String.init)
        components.path = "/" + [basePath, pathParts[0].trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }.joined(separator: "/")
        if pathParts.count > 1 {
            components.percentEncodedQuery = pathParts[1]
        } else if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        return components.url
    }

    private func get<Response: Decodable>(path: String, accessToken: String? = nil, response: Response.Type) async throws -> Response {
        guard let url = Self.url(baseURL: baseURL, path: path) else { throw PostThreadAPIError.invalidBaseURL }

        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        let (data, urlResponse) = try await session.data(for: request)
        guard let httpResponse = urlResponse as? HTTPURLResponse else { throw PostThreadAPIError.unreadableResponse }
        guard (200..<300).contains(httpResponse.statusCode) else { throw PostThreadAPIError.httpStatus(httpResponse.statusCode) }
        do { return try SessionPayloadDecoder.decode(response, from: data) }
        catch { throw PostThreadAPIError.unreadableResponse }
    }
}
