import Foundation

struct WalletTransaction: Decodable, Equatable, Identifiable {
    let id: String
    let kind: String
    let amount: WalletMoney
    let description: String
    let createdAt: String
    let status: String
}

struct WalletTransactionsPage: Decodable, Equatable {
    let data: [WalletTransaction]
    let nextCursor: String?
    let total: Int64?

    static func appending(_ incoming: [WalletTransaction], to current: [WalletTransaction]) -> [WalletTransaction] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }

    func continuing(after requestedCursor: String?, consumedCursors: Set<String>) -> WalletTransactionsPage {
        let candidate = nextCursor?.trimmingCharacters(in: .whitespacesAndNewlines)
        let safeCursor = candidate.flatMap { value in
            guard !value.isEmpty, value != requestedCursor, !consumedCursors.contains(value) else { return nil }
            return value
        }
        return WalletTransactionsPage(data: data, nextCursor: safeCursor, total: total)
    }
}

enum WalletTransactionPresentation {
    static func amount(_ transaction: WalletTransaction) -> String {
        let sign: String
        switch transaction.kind {
        case "credit": sign = "+"
        case "debit": sign = "−"
        default: sign = ""
        }
        return sign + WalletOverviewPresentation.amount(transaction.amount)
    }

    static func direction(_ kind: String) -> String {
        switch kind {
        case "credit": "received"
        case "debit": "sent"
        default: "recorded"
        }
    }

    static func date(_ value: String, locale: Locale = .current, timeZone: TimeZone = .current) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        guard let date else { return value }
        let display = DateFormatter()
        display.locale = locale
        display.timeZone = timeZone
        display.dateStyle = .medium
        display.timeStyle = .none
        return display.string(from: date)
    }

    static func status(_ value: String) -> String {
        switch value {
        case "completed": "Completed"
        case "pending": "Pending"
        case "failed": "Failed"
        default: "Unknown"
        }
    }
}
