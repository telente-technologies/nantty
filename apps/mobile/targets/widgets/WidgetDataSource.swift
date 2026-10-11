import Foundation
import Security
import WidgetKit

enum WidgetDataSource {
  static let appGroup = "group.com.zudomart.app"
  static let keychainService = "zudomart.widgets:no-auth"
  static let tokenKey = "zm.widgetToken"
  static let sessionKey = "zm.widget.session"
  static let snapshotPrefix = "zm.widget.snapshot."
  static let refreshInterval: TimeInterval = 20 * 60
  static let maximumImageBytes = 400_000

  static var sharedDefaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func readSession() -> WidgetSessionDescriptor? {
    guard let raw = sharedDefaults?.string(forKey: sessionKey), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetSessionDescriptor.self, from: data)
  }

  static func readWidgetToken() -> String? {
    let account = Data(tokenKey.utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrGeneric as String: account,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: appGroup,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: kCFBooleanTrue as Any,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func readStoredSnapshot<Payload: Codable>(kind: String, as type: Payload.Type) -> WidgetState<Payload>? {
    guard let raw = sharedDefaults?.string(forKey: snapshotPrefix + kind), let data = raw.data(using: .utf8),
          let envelope = try? JSONDecoder().decode(WidgetSnapshotEnvelope<Payload>.self, from: data) else { return nil }
    switch envelope.state {
    case "signedOut": return .signedOut
    case "ready": return envelope.payload.map { .ready($0, images: [:]) }
    default: return .unavailable
    }
  }

  static func storeSnapshot(kind: String, payloadData: Data) {
    guard let payload = String(data: payloadData, encoding: .utf8) else { return }
    let savedAt = ISO8601DateFormatter().string(from: Date())
    sharedDefaults?.set("{\"state\":\"ready\",\"savedAt\":\"\(savedAt)\",\"payload\":\(payload)}", forKey: snapshotPrefix + kind)
  }

  static func endpoint(path: String, moneyWidget: Bool, session: WidgetSessionDescriptor) -> URL? {
    guard session.apiBaseUrl.hasPrefix("https://"), var components = URLComponents(string: session.apiBaseUrl) else { return nil }
    components.path = path
    if moneyWidget && session.hideAmounts { components.queryItems = [URLQueryItem(name: "amounts", value: "hidden")] }
    return components.url
  }

  static func load<Payload: Codable>(kind: String, path: String, moneyWidget: Bool = false, as type: Payload.Type, imageUrls: (Payload) -> [String]) async -> WidgetState<Payload> {
    guard let session = readSession(), session.signedIn else { return .signedOut }
    if let token = readWidgetToken(), let url = endpoint(path: path, moneyWidget: moneyWidget, session: session) {
      var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      request.setValue("application/json", forHTTPHeaderField: "Accept")
      if let (data, response) = try? await URLSession.shared.data(for: request), let http = response as? HTTPURLResponse {
        if http.statusCode == 200, let payload = try? JSONDecoder().decode(Payload.self, from: data) {
          storeSnapshot(kind: kind, payloadData: data)
          return .ready(payload, images: await downloadImages(imageUrls(payload)))
        }
        if http.statusCode == 403 || http.statusCode == 404 { return .unavailable }
      }
    }
    if case .ready(let payload, _)? = readStoredSnapshot(kind: kind, as: type) {
      return .ready(payload, images: await downloadImages(imageUrls(payload)))
    }
    return readStoredSnapshot(kind: kind, as: type) ?? .unavailable
  }

  static func downloadImages(_ urls: [String]) async -> [String: Data] {
    var images: [String: Data] = [:]
    for raw in urls.prefix(8) where raw.hasPrefix("https://") {
      guard let url = URL(string: raw), let (data, response) = try? await URLSession.shared.data(from: url),
            (response as? HTTPURLResponse)?.statusCode == 200, data.count <= maximumImageBytes else { continue }
      images[raw] = data
    }
    return images
  }

  static func nextRefresh() -> Date { Date().addingTimeInterval(refreshInterval) }
}
