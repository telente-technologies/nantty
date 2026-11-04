import Foundation
import XCTest
@testable import Nantty

final class BuyerOrdersAPITests: XCTestCase {
    func testListRequestUsesBuyerOrdersRouteAndCursorQuery() throws {
        let path = BuyerOrdersRequest.listPath(filter: .paid, cursor: "cursor /+=")
        let components = try XCTUnwrap(URLComponents(string: path))

        XCTAssertEqual(components.path, "/api/v1/orders")
        XCTAssertEqual(components.queryItems?.first(where: { $0.name == "limit" })?.value, "20")
        XCTAssertEqual(components.queryItems?.first(where: { $0.name == "status" })?.value, "paid")
        XCTAssertEqual(components.queryItems?.first(where: { $0.name == "cursor" })?.value, "cursor /+=")
        XCTAssertEqual(BuyerOrderFilter.allCases.map(\.rawValue), ["all", "pending", "paid", "shipped", "delivered", "completed", "cancelled", "disputed"])
    }

    func testDetailPathRejectsPathInjectionAndKeepsOpaqueOrderIdentifier() {
        XCTAssertEqual(BuyerOrdersRequest.detailPath(orderID: "order-123_A"), "/api/v1/orders/order-123_A")
        XCTAssertNil(BuyerOrdersRequest.detailPath(orderID: "../other"))
        XCTAssertNil(BuyerOrdersRequest.detailPath(orderID: "order/other"))
        XCTAssertNil(BuyerOrdersRequest.detailPath(orderID: ""))
    }

    func testListAndDetailDecodeExistingGoOrderViewFields() throws {
        let list = Data(#"{"data":[{"id":"order-1","reference":"NT-1042","status":"shipped","paymentStatus":"paid","items":[{"id":"line-1","product":{"name":"Beans"},"quantity":2,"variant":"Large"}],"total":{"amountMinor":245000,"currency":"NGN"},"store":{"name":"Ayo Market"},"createdAt":"2026-11-03T10:30:00Z"}],"nextCursor":"cursor-2"}"#.utf8)
        let page = try JSONDecoder().decode(BuyerOrdersPage.self, from: list)
        XCTAssertEqual(page.data.first?.store.name, "Ayo Market")
        XCTAssertEqual(page.data.first?.itemSummary, "Beans")
        XCTAssertEqual(page.nextCursor, "cursor-2")

        let detail = Data(#"{"id":"order-1","reference":"NT-1042","status":"shipped","fulfilmentStatus":"shipped","paymentStatus":"paid","paymentMode":"escrow","items":[{"id":"line-1","product":{"name":"Beans"},"quantity":2,"variant":"Large"}],"subtotal":{"amountMinor":200000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":45000,"currency":"NGN"},"total":{"amountMinor":245000,"currency":"NGN"},"store":{"name":"Ayo Market"},"createdAt":"2026-11-03T10:30:00Z","escrowReleaseAt":null,"shipment":{"courierName":"Swift","trackingNumber":"TRACK-1","trackingUrl":"https://carrier.example/track","shippedAt":"2026-11-03T11:00:00Z","estimatedDeliveryAt":null},"delivery":null,"promotionIssue":null}"#.utf8)
        let order = try JSONDecoder().decode(BuyerOrderDetail.self, from: detail)
        XCTAssertEqual(order.total.amountMinor, 245000)
        XCTAssertEqual(order.items.first?.quantity, 2)
        XCTAssertEqual(order.shipment?.trackingNumber, "TRACK-1")
    }

    func testBuyerOrderModelDoesNotRetainCourierTrackingURL() throws {
        let detail = Data(#"{"courierName":"Swift","trackingNumber":"TRACK-1","trackingUrl":"https://carrier.example/track","shippedAt":"2026-11-03T11:00:00Z"}"#.utf8)
        let shipment = try JSONDecoder().decode(BuyerOrderShipment.self, from: detail)
        XCTAssertEqual(shipment.trackingNumber, "TRACK-1")
    }
}
