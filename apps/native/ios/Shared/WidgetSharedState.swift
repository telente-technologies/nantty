import Foundation

enum WidgetSharedState {
    static let appGroup = "group.com.nantty.app"
    static let apiConfiguredKey = "apiConfigured"

    static var isAPIConfigured: Bool {
        UserDefaults(suiteName: appGroup)?.bool(forKey: apiConfiguredKey) ?? false
    }
}
