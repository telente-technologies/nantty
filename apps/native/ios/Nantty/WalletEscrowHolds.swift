import Foundation

struct WalletEscrowHold: Decodable, Equatable, Identifiable {
    let orderId: String
    let orderReference: String
    let productName: String
    let amount: WalletMoney
    let stage: String
    let expectedReleaseAt: String?

    var id: String { orderId }
}

struct WalletEscrowHoldsPage: Decodable, Equatable {
    let data: [WalletEscrowHold]
}

enum WalletEscrowHoldPresentation {
    static func stage(_ value: String) -> String {
        switch value {
        case "paid_into_escrow": "Paid into escrow"
        case "seller_preparing": "Seller preparing"
        case "shipped": "On the way"
        case "delivered": "Delivered"
        case "buyer_confirmed": "Receipt confirmed"
        case "disputed": "In dispute"
        case "under_review": "Under review"
        default:
            value
                .split(separator: "_")
                .map { $0.capitalized }
                .joined(separator: " ")
        }
    }

    static func releaseDate(_ value: String?) -> String? {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return WalletTransactionPresentation.date(value)
    }
}
