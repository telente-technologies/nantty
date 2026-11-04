import XCTest
@testable import Nantty

final class WalletEscrowHoldsTests: XCTestCase {
    func testDecodesEscrowHoldPageWithExactMinorAmountAndReleaseDate() throws {
        let page = try SessionPayloadDecoder.decode(WalletEscrowHoldsPage.self, from: Data(#"{"data":[{"orderId":"order-1","orderReference":"NAN-1042","productName":"Handwoven bag","amount":{"amountMinor":12500,"currency":"NGN"},"stage":"seller_preparing","expectedReleaseAt":"2026-11-08T12:00:00Z"}]}"#.utf8))

        XCTAssertEqual(page.data.count, 1)
        XCTAssertEqual(page.data[0].id, "order-1")
        XCTAssertEqual(page.data[0].amount.amountMinor, 12_500)
        XCTAssertEqual(page.data[0].amount.currency, "NGN")
        XCTAssertEqual(WalletEscrowHoldPresentation.stage(page.data[0].stage), "Seller preparing")
        XCTAssertNotNil(WalletEscrowHoldPresentation.releaseDate(page.data[0].expectedReleaseAt))
    }

    func testEmptyEscrowResponseAndMissingReleaseDateAreSupported() throws {
        let page = try SessionPayloadDecoder.decode(WalletEscrowHoldsPage.self, from: Data(#"{"data":[]}"#.utf8))
        let noDatePage = try SessionPayloadDecoder.decode(WalletEscrowHoldsPage.self, from: Data(#"{"data":[{"orderId":"order-2","orderReference":"NAN-1043","productName":"Ceramic cup","amount":{"amountMinor":5000,"currency":"NGN"},"stage":"unknown_stage","expectedReleaseAt":null}]}"#.utf8))

        XCTAssertTrue(page.data.isEmpty)
        XCTAssertNil(noDatePage.data.first?.expectedReleaseAt)
        XCTAssertNil(WalletEscrowHoldPresentation.releaseDate(nil))
        XCTAssertEqual(WalletEscrowHoldPresentation.stage("unknown_stage"), "Unknown Stage")
    }
}
