import Foundation
import XCTest
@testable import Nantty

final class OrdersWidgetSnapshotTests: XCTestCase {
    func testMapperStoresOnlyBoundedValidatedFieldsAndBuildsAppOwnedDeepLink() throws {
        let response = OrdersWidgetAPIResponse(
            orders: [
                OrdersWidgetAPIItem(
                    id: "550e8400-e29b-41d4-a716-446655440000",
                    reference: "  NT-1\n",
                    statusLabel: "On\u{0007} the way",
                    etaAt: "2026-11-02T15:00:00Z",
                    itemTitle: String(repeating: "x", count: 100),
                    storeName: "  Ada   Store  "
                ),
                OrdersWidgetAPIItem(
                    id: "not-a-uuid",
                    reference: "bad",
                    statusLabel: "Invalid order",
                    etaAt: nil,
                    itemTitle: "Bad",
                    storeName: "Bad Store"
                )
            ],
            activeCount: -2,
            generatedAt: "2026-11-02T12:00:00Z"
        )

        let snapshot = OrdersWidgetSnapshotMapper.make(
            from: response,
            accountFingerprint: "opaque-account-hash",
            now: Date(timeIntervalSince1970: 1_793_604_000)
        )

        XCTAssertEqual(snapshot.state, .ready)
        XCTAssertEqual(snapshot.activeCount, 0)
        XCTAssertEqual(snapshot.orders.count, 1)
        XCTAssertEqual(snapshot.orders[0].reference, "NT-1")
        XCTAssertEqual(snapshot.orders[0].statusLabel, "On the way")
        XCTAssertEqual(snapshot.orders[0].itemTitle.count, 64)
        XCTAssertEqual(snapshot.orders[0].storeName, "Ada Store")
        XCTAssertEqual(snapshot.orders[0].deepLink?.absoluteString, "nantty://orders/550e8400-e29b-41d4-a716-446655440000")
        XCTAssertNil(OrdersWidgetOrder(id: "https://attacker.test", reference: "x", statusLabel: "x", etaAt: nil, itemTitle: "x", storeName: "x").deepLink)
        XCTAssertEqual(
            NanttyWidgetDeepLink.orderID(from: try XCTUnwrap(snapshot.orders[0].deepLink)),
            "550e8400-e29b-41d4-a716-446655440000"
        )
        XCTAssertNil(NanttyWidgetDeepLink.orderID(from: URL(string: "https://orders/550e8400-e29b-41d4-a716-446655440000")!))
        XCTAssertNil(NanttyWidgetDeepLink.orderID(from: URL(string: "nantty://orders/../../settings")!))

        let cachedJSON = String(decoding: try JSONEncoder().encode(snapshot), as: UTF8.self)
        XCTAssertFalse(cachedJSON.contains("imageUrl"))
        XCTAssertFalse(cachedJSON.contains("accessToken"))
        XCTAssertFalse(cachedJSON.contains("attacker.example"))
        XCTAssertFalse(cachedJSON.contains("carrier.example"))
    }

    func testSnapshotExpiresAfterThirtyMinutes() {
        let savedAt = Date(timeIntervalSince1970: 1_000)
        var snapshot = OrdersWidgetSnapshot(
            state: .ready,
            savedAt: savedAt,
            generatedAt: nil,
            activeCount: 0,
            orders: [],
            refreshFailed: false,
            accountFingerprint: "account-a"
        )

        XCTAssertFalse(snapshot.isStale(at: savedAt.addingTimeInterval(29 * 60)))
        XCTAssertTrue(snapshot.isStale(at: savedAt.addingTimeInterval(30 * 60)))
        snapshot.refreshFailed = true
        XCTAssertTrue(snapshot.isStale(at: savedAt.addingTimeInterval(1)))
    }

    func testAppGroupStoreKeepsOnlySameAccountSnapshotAfterRefreshFailure() throws {
        let suiteName = "orders-widget-tests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let initial = OrdersWidgetSnapshot(
            state: .ready,
            savedAt: Date(timeIntervalSince1970: 100),
            generatedAt: nil,
            activeCount: 1,
            orders: [],
            refreshFailed: false,
            accountFingerprint: "account-a"
        )

        OrdersWidgetSnapshotStore.save(initial, defaults: defaults)
        OrdersWidgetSnapshotStore.recordRefreshFailure(
            accountFingerprint: "account-a",
            now: Date(timeIntervalSince1970: 200),
            defaults: defaults
        )
        let stale = try XCTUnwrap(OrdersWidgetSnapshotStore.load(defaults: defaults))
        XCTAssertEqual(stale.state, .ready)
        XCTAssertTrue(stale.refreshFailed)
        XCTAssertTrue(stale.isStale)

        OrdersWidgetSnapshotStore.recordRefreshFailure(
            accountFingerprint: "account-b",
            now: Date(timeIntervalSince1970: 300),
            defaults: defaults
        )
        let isolated = try XCTUnwrap(OrdersWidgetSnapshotStore.load(defaults: defaults))
        XCTAssertEqual(isolated.state, .unavailable)
        XCTAssertTrue(isolated.orders.isEmpty)
        XCTAssertEqual(isolated.accountFingerprint, "account-b")

        OrdersWidgetSnapshotStore.markSignedOut(defaults: defaults)
        let signedOut = try XCTUnwrap(OrdersWidgetSnapshotStore.load(defaults: defaults))
        XCTAssertEqual(signedOut.state, .signedOut)
        XCTAssertTrue(signedOut.orders.isEmpty)
        XCTAssertNil(signedOut.accountFingerprint)
    }
}
