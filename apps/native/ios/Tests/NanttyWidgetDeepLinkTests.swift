import Foundation
import XCTest
@testable import Nantty

final class NanttyWidgetDeepLinkTests: XCTestCase {
    func testQuickActionDestinationsAreAppOwnedAndResolveToExistingSections() throws {
        XCTAssertEqual(NanttyWidgetDeepLink.destination(from: NanttyWidgetDeepLink.feedURL), .feed)
        XCTAssertEqual(NanttyWidgetDeepLink.destination(from: NanttyWidgetDeepLink.createPostURL), .createPost)
        XCTAssertEqual(NanttyWidgetDeepLink.destination(from: NanttyWidgetDeepLink.walletURL), .wallet)
        XCTAssertEqual(NanttyWidgetDeepLink.destination(from: NanttyWidgetDeepLink.messagesURL), .messages)
        XCTAssertEqual(NanttyWidgetDeepLink.destination(from: NanttyWidgetDeepLink.ordersURL), .orders(id: nil))
    }

    func testRejectsUnknownOrDecoratedRoutes() {
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "https://nantty://wallet")!))
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "nantty://admin")!))
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "nantty://wallet?account=other")!))
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "nantty://messages/profile/123")!))
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "nantty://orders/not-a-uuid")!))
        XCTAssertNil(NanttyWidgetDeepLink.destination(from: URL(string: "nantty://orders/550e8400-e29b-41d4-a716-446655440000/extra")!))
    }
}
