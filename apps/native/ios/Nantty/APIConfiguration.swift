import Foundation

enum SharedAppGroup {
    static let identifier = "group.com.nantty.app"
    static let defaults = UserDefaults(suiteName: identifier)
}

struct APIConfiguration {
    let baseURL: URL

    init?(rawValue: String) {
        guard let url = URL(string: rawValue),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil else { return nil }
        baseURL = url
    }
}
