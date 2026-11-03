import Foundation
import XCTest
@testable import Nantty

final class MyProfileMediaTests: XCTestCase {
    func testDecodesProfileImageURLsFromUsersMePayload() throws {
        let data = Data("""
        {"data":{"name":"Ada","username":"ada","bio":"Builder","website":null,
         "avatarUrl":"https://cdn.nantty.com/ada.jpg","bannerUrl":"https://cdn.nantty.com/banner.jpg",
         "followers":4,"following":3,"posts":2,"isPrivate":false}}
        """.utf8)

        let profile = try SessionPayloadDecoder.decode(MyProfile.self, from: data)

        XCTAssertEqual(profile.displayAvatarURL?.absoluteString, "https://cdn.nantty.com/ada.jpg")
        XCTAssertEqual(profile.displayBannerURL?.absoluteString, "https://cdn.nantty.com/banner.jpg")
    }

    func testMissingOrNullMediaURLsRemainOptional() throws {
        let data = Data("""
        {"name":"Ada","username":"ada","bio":"","website":null,
         "avatarUrl":null,"bannerUrl":null,"followers":0,"following":0,"posts":0,"isPrivate":false}
        """.utf8)

        let profile = try SessionPayloadDecoder.decode(MyProfile.self, from: data)

        XCTAssertNil(profile.displayAvatarURL)
        XCTAssertNil(profile.displayBannerURL)
    }

    func testRejectsUnsafeImageURLsAndAllowsLoopbackOnlyHTTPForDevelopment() throws {
        XCTAssertNil(MyProfile.safeImageURL(URL(string: "http://cdn.nantty.com/avatar.jpg")))
        XCTAssertNil(MyProfile.safeImageURL(URL(string: "javascript:alert(1)")))
        XCTAssertNil(MyProfile.safeImageURL(URL(string: "https://user:secret@cdn.nantty.com/avatar.jpg")))
        XCTAssertEqual(
            MyProfile.safeImageURL(URL(string: "http://localhost:8080/avatar.jpg"))?.absoluteString,
            "http://localhost:8080/avatar.jpg"
        )
        XCTAssertEqual(
            MyProfile.safeImageURL(URL(string: "https://cdn.nantty.com/avatar.jpg"))?.absoluteString,
            "https://cdn.nantty.com/avatar.jpg"
        )
    }
}
