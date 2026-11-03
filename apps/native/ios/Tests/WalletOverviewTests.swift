import XCTest
@testable import Nantty

final class WalletOverviewTests: XCTestCase {
    func testDecodesWalletSummaryResponseAndPreservesMinorUnits() throws {
        let wallet = try SessionPayloadDecoder.decode(WalletSummary.self, from: Data("""
        {"available":{"amountMinor":125050,"currency":"NGN"},"pending":{"amountMinor":9000,"currency":"NGN"},"locked":{"amountMinor":0,"currency":"NGN"},"inEscrow":{"amountMinor":9000,"currency":"NGN"},"payoutRequested":{"amountMinor":0,"currency":"NGN"},"negativeBalance":{"amountMinor":0,"currency":"NGN"},"nextAvailableAt":null,"adCredit":{"amountMinor":1500,"currency":"NGN"},"earningsPayable":{"amountMinor":3000,"currency":"NGN"},"debts":{"amountMinor":0,"currency":"NGN"},"coins":{"spendable":42,"earned":8},"lines":[{"key":"available","label":"Available to withdraw","description":"Ready","amount":{"amountMinor":125050,"currency":"NGN"}}],"verification":{"level":1,"withdrawalsUnlocked":false,"waitingForVerification":{"amountMinor":128050,"currency":"NGN"},"nextStep":"identity_check","message":"Verify to withdraw ₦1,280.50"}}
        """.utf8))

        XCTAssertEqual(wallet.available.amountMinor, 125_050)
        XCTAssertEqual(wallet.available.currency, "NGN")
        XCTAssertEqual(wallet.coins, WalletCoinHoldings(spendable: 42, earned: 8))
        XCTAssertEqual(wallet.verification?.message, "Verify to withdraw ₦1,280.50")
        XCTAssertEqual(WalletOverviewPresentation.lines(for: wallet).map(\.key), ["available"])
    }

    func testLegacyWalletWithoutLinesFallsBackToAvailableAndPending() throws {
        let wallet = try SessionPayloadDecoder.decode(WalletSummary.self, from: Data("""
        {"available":{"amountMinor":5000,"currency":"NGN"},"pending":{"amountMinor":2500,"currency":"NGN"},"locked":{"amountMinor":0,"currency":"NGN"},"inEscrow":{"amountMinor":2500,"currency":"NGN"},"payoutRequested":{"amountMinor":0,"currency":"NGN"},"negativeBalance":{"amountMinor":0,"currency":"NGN"},"nextAvailableAt":null,"adCredit":{"amountMinor":0,"currency":"NGN"},"earningsPayable":{"amountMinor":0,"currency":"NGN"},"debts":{"amountMinor":0,"currency":"NGN"},"coins":{"spendable":0,"earned":0},"lines":[],"verification":{"level":0,"withdrawalsUnlocked":false,"waitingForVerification":{"amountMinor":5000,"currency":"NGN"},"nextStep":null,"message":null}}
        """.utf8))

        let lines = WalletOverviewPresentation.lines(for: wallet)
        XCTAssertEqual(lines.map(\.key), ["available", "pending"])
        XCTAssertEqual(lines.map(\.amount.amountMinor), [5_000, 2_500])
    }

    func testCoinBalancesArePresentedAsNonCashUnits() {
        XCTAssertEqual(WalletOverviewPresentation.amount(WalletMoney(amountMinor: 1, currency: "COIN")), "1 coin")
        XCTAssertEqual(WalletOverviewPresentation.amount(WalletMoney(amountMinor: 1_234, currency: "COIN")), "1,234 coins")
    }

    func testDecodesWalletTransactionCursorPageAndKeepsMinorUnits() throws {
        let page = try SessionPayloadDecoder.decode(WalletTransactionsPage.self, from: Data("""
        {"data":[{"id":"line-1","kind":"credit","amount":{"amountMinor":12500,"currency":"NGN"},"description":"Wallet top-up","createdAt":"2026-11-02T10:30:00Z","status":"completed"}],"nextCursor":"cursor-2"}
        """.utf8))

        XCTAssertEqual(page.data.count, 1)
        XCTAssertEqual(page.data[0].id, "line-1")
        XCTAssertEqual(page.data[0].amount.amountMinor, 12_500)
        XCTAssertEqual(page.data[0].amount.currency, "NGN")
        XCTAssertEqual(page.nextCursor, "cursor-2")
        XCTAssertTrue(WalletTransactionPresentation.amount(page.data[0]).hasPrefix("+"))
        XCTAssertEqual(WalletTransactionPresentation.status("pending"), "Pending")
    }

    func testDecodesEmptyWalletTransactionPage() throws {
        let page = try SessionPayloadDecoder.decode(WalletTransactionsPage.self, from: Data("{\"data\":[],\"nextCursor\":null}".utf8))

        XCTAssertTrue(page.data.isEmpty)
        XCTAssertNil(page.nextCursor)
    }

    func testWalletTransactionPagesDeduplicateByStableTransactionID() {
        let first = transaction(id: "one", description: "First")
        let repeated = transaction(id: "one", description: "Duplicate")
        let second = transaction(id: "two", description: "Second")

        let merged = WalletTransactionsPage.appending([repeated, second], to: [first])

        XCTAssertEqual(merged.map(\.id), ["one", "two"])
        XCTAssertEqual(merged.first?.description, "First")
    }

    func testWalletTransactionPageRejectsRepeatedOrBlankContinuationCursor() {
        let repeated = WalletTransactionsPage(data: [], nextCursor: "cursor-1", total: nil)
        XCTAssertNil(repeated.continuing(after: "cursor-1", consumedCursors: ["cursor-1"]).nextCursor)

        let previouslyConsumed = WalletTransactionsPage(data: [], nextCursor: "cursor-2", total: nil)
        XCTAssertNil(previouslyConsumed.continuing(after: "cursor-1", consumedCursors: ["cursor-1", "cursor-2"]).nextCursor)

        let blank = WalletTransactionsPage(data: [], nextCursor: "  \n", total: nil)
        XCTAssertNil(blank.continuing(after: "cursor-1", consumedCursors: ["cursor-1"]).nextCursor)
    }

    func testUnknownTransactionKindIsNotPresentedAsDebit() {
        let transaction = transaction(id: "line-unknown", kind: "adjustment", status: "settled_elsewhere")

        XCTAssertFalse(WalletTransactionPresentation.amount(transaction).hasPrefix("−"))
        XCTAssertEqual(WalletTransactionPresentation.direction(transaction.kind), "recorded")
        XCTAssertEqual(WalletTransactionPresentation.status(transaction.status), "Unknown")
    }

    private func transaction(
        id: String,
        kind: String = "credit",
        description: String = "Wallet transaction",
        status: String = "completed"
    ) -> WalletTransaction {
        WalletTransaction(
            id: id,
            kind: kind,
            amount: WalletMoney(amountMinor: 1_250, currency: "NGN"),
            description: description,
            createdAt: "2026-11-02T10:30:00Z",
            status: status
        )
    }
}
