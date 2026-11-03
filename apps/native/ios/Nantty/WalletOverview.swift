import Foundation

struct WalletMoney: Decodable, Equatable {
    let amountMinor: Int64
    let currency: String
}

struct WalletLine: Decodable, Equatable, Identifiable {
    let key: String
    let label: String
    let description: String
    let amount: WalletMoney

    var id: String { key }
}

struct WalletCoinHoldings: Decodable, Equatable {
    let spendable: Int64
    let earned: Int64
}

struct WalletVerification: Decodable, Equatable {
    let level: Int
    let withdrawalsUnlocked: Bool
    let waitingForVerification: WalletMoney
    let nextStep: String?
    let message: String?
}

struct WalletSummary: Decodable, Equatable {
    let available: WalletMoney
    let pending: WalletMoney
    let locked: WalletMoney?
    let inEscrow: WalletMoney?
    let payoutRequested: WalletMoney?
    let negativeBalance: WalletMoney?
    let nextAvailableAt: String?
    let adCredit: WalletMoney?
    let earningsPayable: WalletMoney?
    let debts: WalletMoney?
    let coins: WalletCoinHoldings?
    let lines: [WalletLine]?
    let verification: WalletVerification?

    private enum CodingKeys: String, CodingKey {
        case available, pending, locked, inEscrow, payoutRequested, negativeBalance
        case nextAvailableAt, adCredit, earningsPayable, debts, coins, lines, verification
    }
}

enum WalletOverviewPresentation {
    static func lines(for wallet: WalletSummary) -> [WalletLine] {
        let serverLines = wallet.lines ?? []
        guard serverLines.isEmpty else { return serverLines }

        return [
            WalletLine(
                key: "available",
                label: "Available to withdraw",
                description: "Sales and creator earnings you can withdraw now, after anything you owe.",
                amount: wallet.available
            ),
            WalletLine(
                key: "pending",
                label: "Pending (escrow)",
                description: "Order money held until the buyer confirms delivery.",
                amount: wallet.pending
            )
        ]
    }

    static func amount(_ money: WalletMoney) -> String {
        if money.currency == "COIN" {
            let count = max(0, money.amountMinor)
            let formatter = NumberFormatter()
            formatter.locale = Locale(identifier: "en_US")
            formatter.numberStyle = .decimal
            let displayCount = formatter.string(from: NSNumber(value: count)) ?? String(count)
            return "\(displayCount) \(count == 1 ? "coin" : "coins")"
        }

        let formatter = NumberFormatter()
        formatter.locale = .current
        formatter.numberStyle = .currency
        formatter.currencyCode = money.currency
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        let decimal = Decimal(money.amountMinor) / Decimal(100)
        return formatter.string(from: NSDecimalNumber(decimal: decimal)) ?? "\(money.currency) \(decimal)"
    }
}
