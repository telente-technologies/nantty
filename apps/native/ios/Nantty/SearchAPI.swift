import Foundation

struct SearchPostResult: Decodable, Identifiable, Equatable {
    let id: String
    let authorId: String
    let caption: String
    let thumbnailUrl: URL?
    let likes: Int
    let views: Int

    private enum CodingKeys: String, CodingKey {
        case id, authorId, caption, thumbnailUrl, likes, views, type
    }

    private struct Raw: Decodable {
        let id: String?
        let authorId: String?
        let caption: String?
        let thumbnailUrl: URL?
        let likes: Int?
        let views: Int?
        let type: String?
    }

    init(from decoder: Decoder) throws {
        let raw = try Raw(from: decoder)
        guard raw.type == "post",
              let id = NotificationRouting.validatedPostID(raw.id),
              let authorId = NotificationRouting.validatedPostID(raw.authorId) else {
            throw SearchAPIError.unreadableResponse
        }
        self.id = id
        self.authorId = authorId
        caption = raw.caption ?? ""
        thumbnailUrl = Self.safeImageURL(raw.thumbnailUrl)
        likes = max(0, raw.likes ?? 0)
        views = max(0, raw.views ?? 0)
    }

    private static func safeImageURL(_ url: URL?) -> URL? {
        guard let url,
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(),
              !host.isEmpty else { return nil }
        guard scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return url
    }
}

struct SearchPostsPage: Decodable, Equatable {
    let data: [SearchPostResult]
    let nextCursor: String?
    let scope: String

    static func appending(_ incoming: [SearchPostResult], to current: [SearchPostResult]) -> [SearchPostResult] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}

enum SearchContentState: Equatable {
    case idle
    case loading
    case error
    case empty
    case results

    static func resolve(queryIsEmpty: Bool, isLoading: Bool, hasError: Bool, hasResults: Bool) -> SearchContentState {
        if queryIsEmpty { return .idle }
        if isLoading && !hasResults { return .loading }
        if hasError && !hasResults { return .error }
        return hasResults ? .results : .empty
    }
}

enum SearchAPIError: LocalizedError {
    case invalidBaseURL
    case invalidQuery
    case httpStatus(Int)
    case unreadableResponse

    var statusCode: Int? {
        if case let .httpStatus(status) = self { return status }
        return nil
    }

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL: return "Set a valid backend URL in Settings to search Nantty."
        case .invalidQuery: return "Enter a search term of 1 to 100 characters."
        case .httpStatus(let status): return "Search failed (HTTP \(status)). Please try again."
        case .unreadableResponse: return "Nantty returned search results that could not be read. Please try again."
        }
    }
}

struct SearchPostsService {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func search(query: String, cursor: String? = nil, accessToken: String? = nil) async throws -> SearchPostsPage {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...100).contains(trimmed.utf16.count), (cursor?.utf16.count ?? 0) <= 300 else { throw SearchAPIError.invalidQuery }
        guard let url = Self.url(baseURL: baseURL, query: trimmed, cursor: cursor) else { throw SearchAPIError.invalidBaseURL }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken, !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SearchAPIError.unreadableResponse }
        guard (200..<300).contains(http.statusCode) else { throw SearchAPIError.httpStatus(http.statusCode) }
        do { return try SessionPayloadDecoder.decode(SearchPostsPage.self, from: data) }
        catch { throw SearchAPIError.unreadableResponse }
    }

    static func url(baseURL: String, query: String, cursor: String? = nil) -> URL? {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else { return nil }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, "api/v1/search"].filter { !$0.isEmpty }.joined(separator: "/")
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "scope", value: "global"),
            URLQueryItem(name: "type", value: "posts"),
            URLQueryItem(name: "limit", value: "20")
        ] + (cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [])
        return components.url
    }
}
