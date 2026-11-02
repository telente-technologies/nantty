import Foundation

enum SharedAppGroup {
    static let identifier = "group.com.nantty.app"
    static let defaults = UserDefaults(suiteName: identifier)
}

struct APIConfiguration {
    let baseURL: URL

    init?(rawValue: String) {
        guard let url = URL(string: rawValue),
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(),
              url.user == nil,
              url.password == nil,
              url.query == nil,
              url.fragment == nil else { return nil }

        let isLocalDevelopmentHost = ["localhost", "127.0.0.1", "::1"].contains(host)
        guard scheme == "https" || (scheme == "http" && isLocalDevelopmentHost) else { return nil }
        baseURL = url
    }
}
