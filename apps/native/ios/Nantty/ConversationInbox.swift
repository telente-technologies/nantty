import Foundation

struct ConversationInboxPeer: Decodable, Equatable {
    let id: String
    let name: String
    let username: String
    let avatarURL: URL?

    private enum CodingKeys: String, CodingKey {
        case id, name, username
        case avatarURL = "avatarUrl"
    }
}

struct ConversationInboxStore: Decodable, Equatable {
    let id: String
    let name: String
    let avatarURL: URL?

    private enum CodingKeys: String, CodingKey {
        case id, name
        case avatarURL = "avatarUrl"
    }
}

enum ConversationKind: String, Decodable, Equatable {
    case direct
    case group
    case channel
    case business
}

struct InboxConversation: Decodable, Equatable, Identifiable {
    let id: String
    let peer: ConversationInboxPeer
    let lastMessageAt: String
    let unread: Int
    let kind: ConversationKind
    let title: String?
    let photoURL: URL?
    let store: ConversationInboxStore?

    private enum CodingKeys: String, CodingKey {
        case id, peer, lastMessageAt, unread, kind, title, store
        case photoURL = "photoUrl"
    }

    var displayTitle: String {
        switch kind {
        case .direct:
            peer.name.isEmpty ? "Conversation" : peer.name
        case .business:
            store?.name ?? title ?? "Business conversation"
        case .channel:
            title ?? (peer.name.isEmpty ? "Channel" : peer.name)
        case .group:
            title ?? "Group conversation"
        }
    }

    var kindLabel: String {
        switch kind {
        case .direct: "Direct message"
        case .group: "Group conversation"
        case .channel: "Channel"
        case .business: "Business conversation"
        }
    }

    var avatarURLForDisplay: URL? {
        let candidate: URL?
        switch kind {
        case .direct: candidate = peer.avatarURL
        case .group, .channel: candidate = photoURL ?? peer.avatarURL
        case .business: candidate = store?.avatarURL ?? peer.avatarURL
        }
        guard let candidate, candidate.scheme?.lowercased() == "https", candidate.host != nil, candidate.user == nil else { return nil }
        return candidate
    }
}

struct ConversationInboxPage: Decodable, Equatable {
    let data: [InboxConversation]
    let nextCursor: String?

    static func appending(_ page: ConversationInboxPage, to current: [InboxConversation]) -> [InboxConversation] {
        var seen = Set(current.map(\.id))
        return current + page.data.filter { seen.insert($0.id).inserted }
    }

    func safeNextCursor(consumed: Set<String>) -> String? {
        guard let nextCursor,
              !nextCursor.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !consumed.contains(nextCursor) else { return nil }
        return nextCursor
    }
}

enum ConversationInboxPresentation {
    static func timestamp(_ value: String, now: Date = .now) -> String {
        let formatter = ISO8601DateFormatter()
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: value) ?? fractionalFormatter.date(from: value)
        guard let date else { return "Date unavailable" }
        if Calendar.current.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        if Calendar.current.isDate(date, equalTo: now, toGranularity: .year) {
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
        return date.formatted(.dateTime.year().month(.abbreviated).day())
    }
}
