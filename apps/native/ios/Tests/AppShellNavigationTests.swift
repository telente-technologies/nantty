import XCTest
import SwiftUI
@testable import Nantty

final class AppShellNavigationTests: XCTestCase {
    func testPrimaryBrowseSectionsMapToFeedAndMartDestinations() {
        XCTAssertEqual(PrimaryBrowseSection.allCases, [.feed, .mart])
        XCTAssertEqual(PrimaryBrowseSection.feed.destination, .home)
        XCTAssertEqual(PrimaryBrowseSection.mart.destination, .mart)
        XCTAssertEqual(PrimaryBrowseSection(destination: .home), .feed)
        XCTAssertEqual(PrimaryBrowseSection(destination: .mart), .mart)
    }

    func testPrimaryBrowseSectionsHaveAccessibleVisibleNamesAndSymbols() {
        XCTAssertEqual(PrimaryBrowseSection.feed.rawValue, "Feed")
        XCTAssertEqual(PrimaryBrowseSection.feed.symbol, "house")
        XCTAssertEqual(PrimaryBrowseSection.mart.rawValue, "Mart")
        XCTAssertEqual(PrimaryBrowseSection.mart.symbol, "bag")
    }

    func testPrimaryBrowseSwipeChangesOnlyForDominantHorizontalMovement() {
        XCTAssertEqual(PrimaryBrowseSection.swipeDestination(from: .feed, horizontal: -100, vertical: 10), .mart)
        XCTAssertEqual(PrimaryBrowseSection.swipeDestination(from: .mart, horizontal: 100, vertical: 10), .feed)
        XCTAssertNil(PrimaryBrowseSection.swipeDestination(from: .feed, horizontal: -40, vertical: 0))
        XCTAssertNil(PrimaryBrowseSection.swipeDestination(from: .feed, horizontal: -100, vertical: 90))
        XCTAssertNil(PrimaryBrowseSection.swipeDestination(from: .mart, horizontal: -100, vertical: 0))
    }

    func testComposerPresentationAdaptsBetweenCompactAndRegularLayouts() {
        XCTAssertEqual(ComposerPresentationStyle.resolve(for: .compact), .fullScreen)
        XCTAssertEqual(ComposerPresentationStyle.resolve(for: .regular), .sheet)
        XCTAssertEqual(ComposerPresentationStyle.resolve(for: nil), .sheet)
    }
}
