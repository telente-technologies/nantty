import Foundation
import XCTest
@testable import Nantty

final class ConversationInboxTests: XCTestCase {
    func testInboxDecodesOnlyConversationMetadataAndDoesNotModelEncryptedPreview() throws {
        let page = try SessionPayloadDecoder.decode(ConversationInboxPage.self, from: Data("""
        {"data":[
          {"id":"conversation-1","peer":{"id":"peer-1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/ada.jpg","verified":true,"isCreator":false},"lastMessage":"","lastMessageKind":"text","lastMessageAt":"2026-11-02T10:30:00.000Z","unread":2,"isFriend":true,"kind":"direct","title":null,"store":null},
          {"id":"conversation-2","peer":{"id":"conversation-2","name":"","username":"","avatarUrl":null,"verified":false,"isCreator":false},"lastMessage":"","lastMessageKind":"text","lastMessageAt":"2026-11-02T10:20:00Z","unread":0,"isFriend":false,"kind":"group","title":null,"store":null}
        ],"nextCursor":"cursor-next"}
        """.utf8))

        XCTAssertEqual(page.data.map(\.displayTitle), ["Ada", "Group conversation"])
        XCTAssertEqual(page.data.map(\.kindLabel), ["Direct message", "Group conversation"])
        XCTAssertEqual(page.data[0].unread, 2)
        XCTAssertEqual(page.data[0].avatarURLForDisplay?.absoluteString, "https://cdn.nantty.com/ada.jpg")
        XCTAssertEqual(page.nextCursor, "cursor-next")
        let modeledFields = Mirror(reflecting: page.data[0]).children.compactMap(\.label)
        XCTAssertFalse(modeledFields.contains("lastMessage"))
        XCTAssertFalse(modeledFields.contains("encryption"))
    }

    func testBusinessInboxUsesStoreNameAndChannelUsesServerTitle() throws {
        let page = try SessionPayloadDecoder.decode(ConversationInboxPage.self, from: Data("""
        {"data":[
          {"id":"business-1","peer":{"id":"business-1","name":"Store","username":"","avatarUrl":null},"lastMessage":"","lastMessageAt":"2026-11-02T10:00:00Z","unread":1,"kind":"business","title":null,"store":{"id":"store-1","name":"Ada Market","avatarUrl":"https://cdn.nantty.com/store.jpg"}},
          {"id":"channel-1","peer":{"id":"channel-1","name":"","username":"","avatarUrl":null},"lastMessage":"","lastMessageAt":"2026-11-02T10:00:00Z","unread":0,"kind":"channel","title":"Announcements","store":null}
        ],"nextCursor":null}
        """.utf8))

        XCTAssertEqual(page.data.map(\.displayTitle), ["Ada Market", "Announcements"])
        XCTAssertEqual(page.data.first?.avatarURLForDisplay?.absoluteString, "https://cdn.nantty.com/store.jpg")
    }

    func testAvatarURLsMustBeHTTPSAndCannotContainUserInfo() throws {
        let page = try SessionPayloadDecoder.decode(ConversationInboxPage.self, from: Data("""
        {"data":[
          {"id":"c1","peer":{"id":"p1","name":"Insecure","username":"a","avatarUrl":"http://cdn.nantty.com/a.jpg"},"lastMessageAt":"2026-11-02T10:00:00Z","unread":0,"kind":"direct"},
          {"id":"c2","peer":{"id":"p2","name":"Embedded credentials","username":"b","avatarUrl":"https://user:pass@cdn.nantty.com/b.jpg"},"lastMessageAt":"2026-11-02T10:00:00Z","unread":0,"kind":"direct"}
        ],"nextCursor":null}
        """.utf8))

        XCTAssertNil(page.data[0].avatarURLForDisplay)
        XCTAssertNil(page.data[1].avatarURLForDisplay)
    }

    func testCursorPaginationDeduplicatesAndRejectsRepeatedCursor() throws {
        let first = try SessionPayloadDecoder.decode(ConversationInboxPage.self, from: Data("""
        {"data":[{"id":"c1","peer":{"id":"p1","name":"One","username":"one","avatarUrl":null},"lastMessage":"","lastMessageAt":"2026-11-02T10:00:00Z","unread":0,"kind":"direct","title":null}],"nextCursor":"cursor-1"}
        """.utf8))
        let second = try SessionPayloadDecoder.decode(ConversationInboxPage.self, from: Data("""
        {"data":[{"id":"c1","peer":{"id":"p1","name":"One","username":"one","avatarUrl":null},"lastMessage":"","lastMessageAt":"2026-11-02T10:00:00Z","unread":0,"kind":"direct","title":null},{"id":"c2","peer":{"id":"p2","name":"Two","username":"two","avatarUrl":null},"lastMessage":"","lastMessageAt":"2026-11-02T09:00:00Z","unread":0,"kind":"direct","title":null}],"nextCursor":"cursor-1"}
        """.utf8))

        XCTAssertEqual(ConversationInboxPage.appending(second, to: first.data).map(\.id), ["c1", "c2"])
        XCTAssertNil(second.safeNextCursor(consumed: ["cursor-1"]))
    }
}
