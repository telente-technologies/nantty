import Foundation

struct OrdersWidgetAPIResponse: Decodable, Equatable {
    let orders: [OrdersWidgetAPIItem]
    let activeCount: Int
    let generatedAt: String
}

struct OrdersWidgetAPIItem: Decodable, Equatable {
    let id: String
    let reference: String
    let statusLabel: String
    let etaAt: String?
    let itemTitle: String
    let storeName: String

    private enum CodingKeys: String, CodingKey {
        case id, reference, statusLabel, etaAt, itemTitle, storeName
    }

}

enum OrdersWidgetSnapshotMapper {
    static func make(
        from response: OrdersWidgetAPIResponse,
        accountFingerprint: String,
        now: Date = .now
    ) -> OrdersWidgetSnapshot {
        let orders = response.orders.prefix(3).compactMap { item -> OrdersWidgetOrder? in
            guard UUID(uuidString: item.id) != nil else { return nil }
            return OrdersWidgetOrder(
                id: item.id,
                reference: text(item.reference, limit: 32),
                statusLabel: text(item.statusLabel, limit: 48),
                etaAt: item.etaAt.flatMap(isoDate),
                itemTitle: text(item.itemTitle, limit: 64),
                storeName: text(item.storeName, limit: 48)
            )
        }
        let generatedAt = isoDate(response.generatedAt)
        return OrdersWidgetSnapshot(
            state: .ready,
            savedAt: now,
            generatedAt: generatedAt,
            activeCount: min(max(response.activeCount, 0), 10_000),
            orders: orders,
            refreshFailed: false,
            accountFingerprint: accountFingerprint
        )
    }

    private static func text(_ value: String, limit: Int) -> String {
        let visibleScalars = String.UnicodeScalarView(
            value.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) }
        )
        let normalized = String(visibleScalars)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(normalized.prefix(limit))
    }

    private static func isoDate(_ value: String) -> Date? {
        ISO8601DateFormatter().date(from: value)
    }
}
