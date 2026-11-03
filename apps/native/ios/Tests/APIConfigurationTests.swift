import Foundation
import XCTest
@testable import Nantty

final class APIConfigurationTests: XCTestCase {
    func testReleaseAcceptsOnlyTheCompiledHTTPSOrigin() throws {
        let trustedURL = try XCTUnwrap(URL(string: "https://api.nantty.com/v1"))
        XCTAssertTrue(APIConfiguration.isAllowed(
            trustedURL,
            host: "api.nantty.com",
            scheme: "https",
            allowsDevelopmentOverride: false,
            trustedReleaseBaseURL: "https://api.nantty.com"
        ))

        let attackerURL = try XCTUnwrap(URL(string: "https://collector.example/v1"))
        XCTAssertFalse(APIConfiguration.isAllowed(
            attackerURL,
            host: "collector.example",
            scheme: "https",
            allowsDevelopmentOverride: false,
            trustedReleaseBaseURL: "https://api.nantty.com"
        ))
    }

    func testReleaseRejectsDifferentPortsAndInsecureBundledOrigins() throws {
        let alternatePortURL = try XCTUnwrap(URL(string: "https://api.nantty.com:8443/v1"))
        XCTAssertFalse(APIConfiguration.isAllowed(
            alternatePortURL,
            host: "api.nantty.com",
            scheme: "https",
            allowsDevelopmentOverride: false,
            trustedReleaseBaseURL: "https://api.nantty.com"
        ))

        let localURL = try XCTUnwrap(URL(string: "http://localhost:8080/v1"))
        XCTAssertFalse(APIConfiguration.isAllowed(
            localURL,
            host: "localhost",
            scheme: "http",
            allowsDevelopmentOverride: false,
            trustedReleaseBaseURL: "http://localhost:8080"
        ))
    }

    func testDebugMayUseLoopbackHTTPButNotRemoteHTTP() throws {
        let localURL = try XCTUnwrap(URL(string: "http://127.0.0.1:8080/v1"))
        XCTAssertTrue(APIConfiguration.isAllowed(
            localURL,
            host: "127.0.0.1",
            scheme: "http",
            allowsDevelopmentOverride: true
        ))

        let remoteURL = try XCTUnwrap(URL(string: "http://api.nantty.com/v1"))
        XCTAssertFalse(APIConfiguration.isAllowed(
            remoteURL,
            host: "api.nantty.com",
            scheme: "http",
            allowsDevelopmentOverride: true
        ))
    }
}
