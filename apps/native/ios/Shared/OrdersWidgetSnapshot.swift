import Foundation

enum OrdersWidgetSnapshotState: String, Codable {
    case signedOut
    case unavailable
    case ready
}

struct OrdersWidgetOrder: Codable, Equatable, Identifiable {
    let id: String
    let reference: String
    let statusLabel: String
    let etaAt: Date?
    let itemTitle: String
    let storeName: String

    var deepLink: URL? {
        NanttyWidgetDeepLink.orderURL(id: id)
    }
}

enum NanttyWidgetDeepLink {
    static let feedURL = URL(string: "nantty://feed")!
    static let createPostURL = URL(string: "nantty://create")!
    static let walletURL = URL(string: "nantty://wallet")!
    static let messagesURL = URL(string: "nantty://messages")!
    static let ordersURL = URL(string: "nantty://orders")!

    enum Destination: Equatable {
        case feed
        case createPost
        case wallet
        case messages
        case orders(id: String?)
    }

    static func destination(from url: URL) -> Destination? {
        guard url.scheme?.lowercased() == "nantty",
              url.user == nil,
              url.password == nil,
              url.port == nil,
              url.query == nil,
              url.fragment == nil,
              let host = url.host?.lowercased() else { return nil }

        let path = url.path
        switch host {
        case "feed" where path.isEmpty || path == "/": return .feed
        case "create" where path.isEmpty || path == "/": return .createPost
        case "wallet" where path.isEmpty || path == "/": return .wallet
        case "messages" where path.isEmpty || path == "/": return .messages
        case "orders":
            let components = Array(url.pathComponents.dropFirst())
            guard components.count <= 1 else { return nil }
            guard let id = components.first else { return .orders(id: nil) }
            guard UUID(uuidString: id) != nil else { return nil }
            return .orders(id: id)
        default:
            return nil
        }
    }

    static func orderURL(id: String) -> URL? {
        guard UUID(uuidString: id) != nil else { return nil }
        return URL(string: "nantty://orders/\(id)")
    }

    static func orderID(from url: URL) -> String? {
        guard case .orders(let id) = destination(from: url) else { return nil }
        return id
    }
}

struct OrdersWidgetSnapshot: Codable, Equatable {
    var state: OrdersWidgetSnapshotState
    var savedAt: Date
    var generatedAt: Date?
    var activeCount: Int
    var orders: [OrdersWidgetOrder]
    var refreshFailed: Bool
    var accountFingerprint: String?

    static func signedOut(now: Date = .now) -> Self {
        Self(state: .signedOut, savedAt: now, generatedAt: nil, activeCount: 0, orders: [], refreshFailed: false, accountFingerprint: nil)
    }

    static func unavailable(now: Date = .now, accountFingerprint: String? = nil) -> Self {
        Self(state: .unavailable, savedAt: now, generatedAt: nil, activeCount: 0, orders: [], refreshFailed: true, accountFingerprint: accountFingerprint)
    }

    var isStale: Bool {
        isStale(at: .now)
    }

    func isStale(at now: Date, maxAge: TimeInterval = 30 * 60) -> Bool {
        refreshFailed || now.timeIntervalSince(savedAt) >= maxAge
    }
}

enum OrdersWidgetSnapshotStore {
    static let key = "widget.orders.snapshot.v1"

    static func load(defaults: UserDefaults? = nil) -> OrdersWidgetSnapshot? {
        guard let data = container(defaults: defaults)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(OrdersWidgetSnapshot.self, from: data)
    }

    static func save(_ snapshot: OrdersWidgetSnapshot, defaults: UserDefaults? = nil) {
        guard let data = try? JSONEncoder().encode(snapshot), let container = container(defaults: defaults) else { return }
        container.set(data, forKey: key)
    }

    static func recordRefreshFailure(accountFingerprint: String, now: Date = .now, defaults: UserDefaults? = nil) {
        guard var snapshot = load(defaults: defaults), snapshot.state == .ready else {
            save(.unavailable(now: now, accountFingerprint: accountFingerprint), defaults: defaults)
            return
        }
        guard snapshot.accountFingerprint == accountFingerprint else {
            save(.unavailable(now: now, accountFingerprint: accountFingerprint), defaults: defaults)
            return
        }
        snapshot.savedAt = now
        snapshot.refreshFailed = true
        save(snapshot, defaults: defaults)
    }

    static func markSignedOut(now: Date = .now, defaults: UserDefaults? = nil) {
        save(.signedOut(now: now), defaults: defaults)
    }

    private static func container(defaults: UserDefaults?) -> UserDefaults? {
        defaults ?? UserDefaults(suiteName: WidgetSharedState.appGroup)
    }
}
