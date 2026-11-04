import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct MartCategory: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let parentId: String?
    let depth: Int

    private struct Raw: Decodable {
        let id: String?
        let name: String?
        let parentId: String?
        let depth: Int?
    }

    init(from decoder: Decoder) throws {
        let raw = try Raw(from: decoder)
        guard let id = raw.id, MartCatalogAPI.isSafeIdentifier(id),
              let name = raw.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else {
            throw MartCatalogAPIError.unreadableResponse
        }
        self.id = id
        self.name = name
        parentId = raw.parentId
        depth = max(0, raw.depth ?? 0)
    }
}

struct MartHome: Decodable, Equatable {
    let categories: [MartCategory]
}

struct MartProduct: Decodable, Identifiable, Equatable {
    struct Price: Decodable, Equatable {
        let amountMinor: Int64
        let currency: String
    }

    let id: String
    let name: String
    let price: Price
    let imageUrl: URL?
    let stock: Int
    let hasVariants: Bool

    private struct Raw: Decodable {
        let id: String?
        let name: String?
        let price: Price?
        let imageUrl: URL?
        let stock: Int?
        let hasVariants: Bool?
    }

    init(from decoder: Decoder) throws {
        let raw = try Raw(from: decoder)
        guard let id = raw.id, MartCatalogAPI.isSafeIdentifier(id),
              let name = raw.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty,
              let price = raw.price, price.amountMinor >= 0,
              price.currency.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil else {
            throw MartCatalogAPIError.unreadableResponse
        }
        self.id = id
        self.name = name
        self.price = price
        imageUrl = Self.safeImageURL(raw.imageUrl)
        stock = max(0, raw.stock ?? 0)
        hasVariants = raw.hasVariants ?? false
    }

    private static func safeImageURL(_ url: URL?) -> URL? {
        guard let url,
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(), !host.isEmpty,
              url.user == nil, url.password == nil else { return nil }
        guard scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return url
    }
}

struct MartStoreSummary: Decodable, Equatable {
    let id: String
    let name: String
    let logoUrl: URL?
    let rating: Double
    let ratingCount: Int
    let reviewCount: Int

    private struct Raw: Decodable {
        let id: String?
        let name: String?
        let logoUrl: URL?
        let rating: Double?
        let ratingCount: Int?
        let reviewCount: Int?
    }

    init(from decoder: Decoder) throws {
        let raw = try Raw(from: decoder)
        guard let id = raw.id, MartCatalogAPI.isSafeIdentifier(id),
              let name = raw.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else {
            throw MartCatalogAPIError.unreadableResponse
        }
        self.id = id
        self.name = name
        logoUrl = MartCatalogAPI.safeImageURL(raw.logoUrl)
        rating = raw.rating.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } ?? 0
        ratingCount = max(0, raw.ratingCount ?? 0)
        reviewCount = max(0, raw.reviewCount ?? 0)
    }
}

struct MartProductDetail: Decodable, Equatable {
    let id: String
    let title: String
    let price: MartProduct.Price
    let images: [URL]
    let stock: Int
    let rating: Double
    let promo: String?
    let sizes: [String]
    let colors: [String]
    let shippingInfo: String
    let description: String
    let store: MartStoreSummary

    private struct Raw: Decodable {
        let id: String?
        let title: String?
        let name: String?
        let price: MartProduct.Price?
        let imageUrl: URL?
        let images: [URL]?
        let stock: Int?
        let rating: Double?
        let promo: String?
        let sizes: [String]?
        let colors: [String]?
        let shippingInfo: String?
        let description: String?
        let store: MartStoreSummary?
    }

    init(from decoder: Decoder) throws {
        let raw = try Raw(from: decoder)
        guard let id = raw.id, MartCatalogAPI.isSafeIdentifier(id),
              let title = (raw.title ?? raw.name)?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
              let price = raw.price, price.amountMinor >= 0,
              price.currency.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil,
              let store = raw.store else {
            throw MartCatalogAPIError.unreadableResponse
        }
        self.id = id
        self.title = title
        self.price = price
        let gallery = (raw.images ?? []).compactMap(MartCatalogAPI.safeImageURL)
        images = gallery.isEmpty ? [raw.imageUrl].compactMap(MartCatalogAPI.safeImageURL) : gallery
        stock = max(0, raw.stock ?? 0)
        rating = raw.rating.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } ?? 0
        promo = raw.promo?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
        sizes = (raw.sizes ?? []).compactMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty }
        colors = (raw.colors ?? []).compactMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty }
        shippingInfo = raw.shippingInfo?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        description = raw.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.store = store
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

enum MartProductPresentation {
    static func price(_ price: MartProduct.Price, locale: Locale = .current) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .currency
        formatter.currencyCode = price.currency
        guard let exponent = minorUnitExponent(currency: price.currency, locale: locale) else {
            return "\(price.currency) \(price.amountMinor)"
        }
        var divisor = Decimal(1)
        for _ in 0..<exponent { divisor *= 10 }
        let amount = Decimal(price.amountMinor) / divisor
        return formatter.string(from: NSDecimalNumber(decimal: amount)) ?? "\(price.currency) \(amount)"
    }

    static func minorUnitExponent(currency: String, locale: Locale) -> Int? {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        guard let sample = formatter.string(from: 1),
              let separator = formatter.decimalSeparator,
              let separatorRange = sample.range(of: separator) else { return 0 }
        let fraction = sample[separatorRange.upperBound...].prefix { character in
            character.unicodeScalars.allSatisfy(CharacterSet.decimalDigits.contains)
        }
        return fraction.count
    }
}

struct MartProductsPage: Decodable, Equatable {
    let data: [MartProduct]
    let nextCursor: String?

    static func appending(_ incoming: [MartProduct], to current: [MartProduct]) -> [MartProduct] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}

enum MartCatalogAPIError: LocalizedError {
    case invalidBaseURL
    case httpStatus(Int)
    case unreadableResponse

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL: "Set a valid backend URL in Settings to browse the Mart."
        case .httpStatus(let status): "The Mart request failed (HTTP \(status)). Please try again."
        case .unreadableResponse: "Nantty returned catalogue data that could not be read. Please try again."
        }
    }
}

struct MartCatalogAPI {
    let baseURL: String
    let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchHome() async throws -> MartHome {
        try await get(path: "/api/v1/mart/home", queryItems: [], response: MartHome.self)
    }

    func fetchProducts(categoryId: String? = nil, cursor: String? = nil) async throws -> MartProductsPage {
        var queryItems = [URLQueryItem(name: "limit", value: "20")]
        if let categoryId {
            guard Self.isSafeIdentifier(categoryId) else { throw MartCatalogAPIError.unreadableResponse }
            queryItems.append(URLQueryItem(name: "categoryId", value: categoryId))
        }
        if let cursor {
            guard cursor.utf16.count <= 300 else { throw MartCatalogAPIError.unreadableResponse }
            queryItems.append(URLQueryItem(name: "cursor", value: cursor))
        }
        return try await get(path: "/api/v1/products", queryItems: queryItems, response: MartProductsPage.self)
    }

    func fetchProductDetail(id: String) async throws -> MartProductDetail {
        guard Self.isSafeIdentifier(id) else { throw MartCatalogAPIError.unreadableResponse }
        let detail: MartProductDetail = try await get(path: "/api/v1/products/\(id)", queryItems: [], response: MartProductDetail.self)
        guard detail.id == id else { throw MartCatalogAPIError.unreadableResponse }
        return detail
    }

    static func isSafeIdentifier(_ value: String) -> Bool {
        !value.isEmpty && value.utf16.count <= 100 && value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil
    }

    static func safeImageURL(_ url: URL?) -> URL? {
        guard let url, let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(), !host.isEmpty,
              url.user == nil, url.password == nil else { return nil }
        guard scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return url
    }

    static func url(baseURL: String, path: String, queryItems: [URLQueryItem]) -> URL? {
        guard let configuration = APIConfiguration(rawValue: baseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else { return nil }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = "/" + [basePath, path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }.joined(separator: "/")
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url
    }

    private func get<Value: Decodable>(path: String, queryItems: [URLQueryItem], response: Value.Type) async throws -> Value {
        guard let url = Self.url(baseURL: baseURL, path: path, queryItems: queryItems) else {
            throw MartCatalogAPIError.invalidBaseURL
        }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw MartCatalogAPIError.unreadableResponse }
        guard (200..<300).contains(http.statusCode) else { throw MartCatalogAPIError.httpStatus(http.statusCode) }
        do { return try SessionPayloadDecoder.decode(Value.self, from: data) }
        catch { throw MartCatalogAPIError.unreadableResponse }
    }
}
