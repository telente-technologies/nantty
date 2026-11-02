# Nantty native iOS foundation

This is a native SwiftUI app and WidgetKit extension, defined with XcodeGen in `project.yml`. Generate the Xcode project with `xcodegen generate`, then open `Nantty.xcodeproj` in Xcode. The app and widget use bundle identifiers `com.nantty.app` and `com.nantty.app.widget` and share the `group.com.nantty.app` app group.

The app shell is intentionally limited to product identity and backend configuration. It does not claim to implement marketplace or social workflows. Set the backend base URL in Settings; the initial value follows the repository's local gateway convention (`http://localhost:8080`). For a physical device, configure a reachable development host. API configuration validation is present, but this scaffold does not yet issue API requests.

The API URL stays in the app's private preferences. The widget reads only a Boolean backend-configured flag from app-group `UserDefaults`. It makes no network requests and does not read tokens, account details, messages, orders, balances, hosts, or other sensitive data. Do not add credentials or sensitive user state to the app group.

## Apple design guidance used

- [Technology Overviews: Interface fundamentals](https://developer.apple.com/documentation/technologyoverviews/interface-fundamentals)
- [UI Design Dos and Don'ts](https://developer.apple.com/design/tips/)
- [Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [SwiftUI](https://developer.apple.com/swiftui/)
- [Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/)
- [Technology Overviews: Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)

The shell uses system navigation and form controls, size-class-aware split navigation, Dynamic Type-compatible text, semantic colors, and safe-area-respecting layouts. Standard navigation, list, and form containers keep content within system-reserved regions. Standard system chrome receives the platform's Liquid Glass treatment where supported; no custom decorative glass surfaces are added. Layout decisions do not depend on a specific device model, orientation, hinge, or reserved region.

## Build availability

XcodeGen and Xcode are required to generate and build the project. The checked-in XcodeGen definition is the source of truth; the generated `.xcodeproj` is not committed.
