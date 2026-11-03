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

        #if DEBUG
        let allowsDevelopmentOverride = true
        #else
        let allowsDevelopmentOverride = false
        #endif

        guard Self.isAllowed(url, host: host, scheme: scheme, allowsDevelopmentOverride: allowsDevelopmentOverride) else {
            return nil
        }
        baseURL = url
    }

    static func isAllowed(
        _ url: URL,
        host: String,
        scheme: String,
        allowsDevelopmentOverride: Bool,
        trustedReleaseBaseURL: String? = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String
    ) -> Bool {
        let localHosts = ["localhost", "127.0.0.1", "::1"]
        if allowsDevelopmentOverride {
            return scheme == "https" || (scheme == "http" && localHosts.contains(host))
        }

        guard scheme == "https",
              let trustedReleaseBaseURL,
              let trustedURL = URL(string: trustedReleaseBaseURL),
              trustedURL.scheme?.lowercased() == "https",
              trustedURL.user == nil,
              trustedURL.password == nil,
              trustedURL.query == nil,
              trustedURL.fragment == nil,
              trustedURL.host?.lowercased() == host,
              (trustedURL.port ?? 443) == (url.port ?? 443) else { return false }
        return true
    }
}
