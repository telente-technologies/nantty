import XCTest
@testable import Nantty

final class MartGridLayoutTests: XCTestCase {
    func testAccessibilityTextUsesFewerColumns() {
        XCTAssertEqual(MartGridLayout.columnCount(isCompactWidth: true, isAccessibilityTextSize: true), 1)
        XCTAssertEqual(MartGridLayout.columnCount(isCompactWidth: false, isAccessibilityTextSize: true), 2)
    }

    func testStandardTextPreservesExistingGridDensity() {
        XCTAssertEqual(MartGridLayout.columnCount(isCompactWidth: true, isAccessibilityTextSize: false), 2)
        XCTAssertEqual(MartGridLayout.columnCount(isCompactWidth: false, isAccessibilityTextSize: false), 3)
    }
}
