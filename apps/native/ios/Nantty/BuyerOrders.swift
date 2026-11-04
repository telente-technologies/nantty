import Foundation

enum BuyerOrderFilter: String, CaseIterable, Identifiable {
    case all
    case pending
    case paid
    case shipped
    case delivered
    case completed
    case cancelled
    case disputed

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .pending: "Pending"
        case .paid: "In progress"
        case .shipped: "Shipped"
        case .delivered: "Delivered"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .disputed: "Disputed"
        }
    }
}

struct BuyerOrdersPage: Decodable, Equatable {
    let data: [BuyerOrderSummary]
    let nextCursor: String?

    static func appending(_ incoming: [BuyerOrderSummary], to current: [BuyerOrderSummary]) -> [BuyerOrderSummary] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}

struct BuyerOrderSummary: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let reference: String
    let status: String
    let paymentStatus: String
    let items: [BuyerOrderLine]
    let total: BuyerOrderMoney
    let store: BuyerOrderStore
    let createdAt: String

    var itemSummary: String {
        items.prefix(2).map(\.name).joined(separator: ", ")
    }
}

struct BuyerOrderDetail: Decodable, Equatable {
    let id: String
    let reference: String
    let status: String
    let fulfilmentStatus: String
    let paymentStatus: String
    let paymentMode: String
    let items: [BuyerOrderLine]
    let subtotal: BuyerOrderMoney
    let discount: BuyerOrderMoney
    let storeCredit: BuyerOrderMoney
    let shipping: BuyerOrderMoney
    let total: BuyerOrderMoney
    let store: BuyerOrderStore
    let createdAt: String
    let escrowReleaseAt: String?
    let shipment: BuyerOrderShipment?
    let delivery: BuyerOrderDelivery?
    let promotionIssue: BuyerOrderPromotionIssue?
}

struct BuyerOrderLine: Decodable, Equatable, Hashable, Identifiable {
    let id: String
    let product: BuyerOrderProduct
    let quantity: Int
    let variant: String?

    var name: String { product.name }
}

struct BuyerOrderProduct: Decodable, Equatable, Hashable {
    let name: String
}

struct BuyerOrderMoney: Decodable, Equatable, Hashable {
    let amountMinor: Int64
    let currency: String
}

struct BuyerOrderStore: Decodable, Equatable, Hashable {
    let name: String
}

struct BuyerOrderShipment: Decodable, Equatable {
    let courierName: String
    let trackingNumber: String
    let shippedAt: String
    let estimatedDeliveryAt: String?

}

struct BuyerOrderDelivery: Decodable, Equatable {
    let status: String
    let riderName: String?
    let riderPhone: String?
    let estimatedDeliveryAt: String?
    let attempts: Int
    let lastAttemptNote: String?
}

struct BuyerOrderPromotionIssue: Decodable, Equatable {
    let code: String
    let message: String
}

enum BuyerOrdersRequest {
    static let pageSize = 20

    static func listPath(filter: BuyerOrderFilter = .all, cursor: String? = nil) -> String {
        var components = URLComponents()
        components.path = "/api/v1/orders"
        var queryItems = [URLQueryItem(name: "limit", value: String(pageSize))]
        if filter != .all { queryItems.append(URLQueryItem(name: "status", value: filter.rawValue)) }
        if let cursor, !cursor.isEmpty { queryItems.append(URLQueryItem(name: "cursor", value: cursor)) }
        components.queryItems = queryItems
        return components.string ?? "/api/v1/orders?limit=\(pageSize)"
    }

    static func detailPath(orderID: String) -> String? {
        guard orderID.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil else { return nil }
        return "/api/v1/orders/\(orderID)"
    }
}
