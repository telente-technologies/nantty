import Foundation
import XCTest
@testable import Nantty

final class NotificationRoutingTests: XCTestCase {
    func testRoutesOnlyValidatedPostIDsFromStructuredData() throws {
        let notification = try decodeNotification(#"{"id":"n1","category":"social","title":"A","body":"B","createdAt":"2026-11-02T10:00:00Z","read":true,"url":"https://attacker.example/","data":{"postId":"post_1-abc"}}"#)

        XCTAssertEqual(NotificationRouting.destination(for: notification), .post("post_1-abc"))
    }

    func testIgnoresURLAndUnsupportedDataWhenPostIDIsAbsent() throws {
        let notification = try decodeNotification(#"{"id":"n2","category":"social","title":"A","body":"B","createdAt":"2026-11-02T10:00:00Z","read":true,"url":"/post/safe-looking","data":{"commentId":"comment_1","screen":"AccountStatus"}}"#)

        XCTAssertNil(NotificationRouting.destination(for: notification))
    }

    func testRoutesAcceptedFollowNotificationToValidatedActorProfile() throws {
        let notification = try decodeNotification(#"{"id":"n3","category":"social","kind":"followRequestAccepted","title":"A","body":"B","createdAt":"2026-11-02T10:00:00Z","read":true,"actor":{"id":"user_1","name":"A"},"data":{}}"#)

        XCTAssertEqual(NotificationRouting.destination(for: notification), .profile("user_1"))
    }

    func testRejectsUnsafeAcceptedFollowActorID() throws {
        let notification = try decodeNotification(#"{"id":"n4","category":"social","kind":"followRequestAccepted","title":"A","body":"B","createdAt":"2026-11-02T10:00:00Z","read":true,"actor":{"id":"../private","name":"A"},"data":{}}"#)

        XCTAssertNil(NotificationRouting.destination(for: notification))
    }

    func testRejectsUnsafeOrUnboundedPostIDs() {
        for value in ["", ".", "../private", "post/other", "post?next=x", "https://evil.test", "post é", String(repeating: "a", count: 129)] {
            XCTAssertNil(NotificationRouting.validatedPostID(value), "Unexpectedly accepted: \(value)")
        }
        XCTAssertNil(NotificationRouting.validatedPostID(nil))
    }

    private func decodeNotification(_ json: String) throws -> AppNotification {
        try JSONDecoder().decode(AppNotification.self, from: Data(json.utf8))
    }
}
