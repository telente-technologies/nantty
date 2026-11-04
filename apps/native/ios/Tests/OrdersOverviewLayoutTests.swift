import XCTest
@testable import Nantty

final class OrdersOverviewLayoutTests: XCTestCase {
    func testCompactWidthStacksOrderMetadata() {
        XCTAssertEqual(
            OrdersOverviewMetadataLayout.resolve(isCompactWidth: true, isAccessibilityTextSize: false),
            .stacked
        )
    }

    func testAccessibilityTextStacksOrderMetadataEvenInRegularWidth() {
        XCTAssertEqual(
            OrdersOverviewMetadataLayout.resolve(isCompactWidth: false, isAccessibilityTextSize: true),
            .stacked
        )
    }

    func testRegularWidthUsesFitLayoutForNarrowSplitViewColumns() {
        XCTAssertEqual(
            OrdersOverviewMetadataLayout.resolve(isCompactWidth: false, isAccessibilityTextSize: false),
            .fit
        )
    }
}
