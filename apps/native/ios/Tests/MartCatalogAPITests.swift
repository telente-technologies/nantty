import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import Nantty

final class MartCatalogAPITests: XCTestCase {
    func testBuildsProductsURLWithCategoryAndOpaqueCursor() throws {
        let cursor = "eyJvZmZzZXQiOjJ9+opaque&next"
        let url = try XCTUnwrap(MartCatalogAPI.url(
            baseURL: "https://api.nantty.com/v1",
            path: "/api/v1/products",
            queryItems: [URLQueryItem(name: "limit", value: "20"), URLQueryItem(name: "categoryId", value: "cat_123"), URLQueryItem(name: "cursor", value: cursor)]
        ))

        XCTAssertEqual(url.path, "/v1/api/v1/products")
        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, [
            URLQueryItem(name: "limit", value: "20"),
            URLQueryItem(name: "categoryId", value: "cat_123"),
            URLQueryItem(name: "cursor", value: cursor)
        ])
    }

    func testFetchProductsSendsPublicRequestAndDecodesPage() async throws {
        var capturedRequest: URLRequest?
        MartCatalogStubURLProtocol.handler = { request in
            capturedRequest = request
            return (200, Data(#"{"data":[{"id":"product_1","name":"Handwoven tote","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/tote.jpg","stock":4,"hasVariants":false}],"nextCursor":"next"}"#.utf8))
        }
        defer { MartCatalogStubURLProtocol.handler = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MartCatalogStubURLProtocol.self]
        let api = MartCatalogAPI(baseURL: "https://api.nantty.test", session: URLSession(configuration: configuration))

        let page = try await api.fetchProducts(categoryId: "cat_1", cursor: "cursor_2")

        XCTAssertEqual(page.data.map(\.id), ["product_1"])
        XCTAssertEqual(page.nextCursor, "next")
        XCTAssertNil(capturedRequest?.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(URLComponents(url: try XCTUnwrap(capturedRequest?.url), resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "categoryId" })?.value, "cat_1")
    }

    func testRejectsUnsafeProductIdentityAndImageURL() throws {
        let unsafeId = Data(#"{"data":[{"id":"../other","name":"Item","price":{"amountMinor":100,"currency":"NGN"}}],"nextCursor":null}"#.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(MartProductsPage.self, from: unsafeId))

        let unsafeImage = Data(#"{"data":[{"id":"product_1","name":"Item","price":{"amountMinor":100,"currency":"NGN"},"imageUrl":"javascript:alert(1)"}],"nextCursor":null}"#.utf8)
        let decoded = try JSONDecoder().decode(MartProductsPage.self, from: unsafeImage)
        XCTAssertNil(decoded.data.first?.imageUrl)
    }

    func testDecodesMartCategoriesAndRejectsUnsafeCategoryIDs() throws {
        let home = try JSONDecoder().decode(MartHome.self, from: Data(#"{"banners":[],"categories":[{"id":"cat_1","name":"Home","parentId":null,"depth":0}]}"#.utf8))
        XCTAssertEqual(home.categories.map(\.name), ["Home"])

        let unsafe = Data(#"{"categories":[{"id":"../other","name":"Home"}]}"#.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(MartHome.self, from: unsafe))
    }

    func testAppendsCatalogPagesWithoutDuplicateProducts() throws {
        let page = try JSONDecoder().decode(MartProductsPage.self, from: Data(#"{"data":[{"id":"product_1","name":"Item","price":{"amountMinor":100,"currency":"NGN"}}],"nextCursor":null}"#.utf8))
        XCTAssertEqual(MartProductsPage.appending(page.data, to: page.data).map(\.id), ["product_1"])
    }

    func testProductPriceUsesFoundationCurrencyMinorUnitExponent() {
        let locale = Locale(identifier: "en_US")
        let zeroDecimalCurrency = MartProduct.Price(amountMinor: 1_250, currency: "JPY")
        let naira = MartProduct.Price(amountMinor: 125_000, currency: "NGN")

        XCTAssertEqual(MartProductPresentation.minorUnitExponent(currency: "JPY", locale: locale), 0)
        XCTAssertEqual(MartProductPresentation.minorUnitExponent(currency: "NGN", locale: locale), 2)
        XCTAssertTrue(MartProductPresentation.price(zeroDecimalCurrency, locale: locale).contains("1,250"))
        XCTAssertTrue(MartProductPresentation.price(naira, locale: locale).contains("1,250.00"))
    }
}

private final class MartCatalogStubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Int, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler, let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let result = handler(request)
        guard let response = HTTPURLResponse(url: url, statusCode: result.0, httpVersion: nil, headerFields: nil) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: result.1)
        client?.urlProtocolDidFinishLoading(self)
    }
}
