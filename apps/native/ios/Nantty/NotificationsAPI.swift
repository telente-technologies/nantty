import Foundation

enum NotificationFilter: String, CaseIterable, Identifiable {
    case all
    case mentions

    var id: String { rawValue }
    var title: String { self == .all ? "All" : "Mentions" }
}

struct NotificationActor: Decodable {
    let id: String
    let name: String
    let username: String?
    let avatarUrl: URL?
    let verified: Bool?
}

struct AppNotification: Decodable, Identifiable {
    let id: String
    let category: String
    let kind: String?
    let title: String
    let body: String
    let createdAt: String
    let read: Bool
    let actor: NotificationActor?
    // Link data is intentionally decoded as data only; this slice does not route it.
    let url: String?
    let data: [String: String]?
}

struct NotificationsPage: Decodable {
    let data: [AppNotification]
    let nextCursor: String?

    static func appending(_ incoming: [AppNotification], to current: [AppNotification]) -> [AppNotification] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}
