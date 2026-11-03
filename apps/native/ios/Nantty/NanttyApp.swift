import SwiftUI

@main
struct NanttyApp: App {
    @State private var session = SessionModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            AppShell()
                .environment(session)
                .tint(Color(red: 32.0 / 255.0, green: 67.0 / 255.0, blue: 245.0 / 255.0))
                .task { await session.restoreSession() }
                .onChange(of: session.phase) { _, phase in
                    switch phase {
                    case .signedIn:
                        Task { await OrdersWidgetUpdater.refresh(using: session) }
                    case .signedOut:
                        OrdersWidgetUpdater.markSignedOut()
                    case .restoreUnavailable where session.user == nil:
                        OrdersWidgetUpdater.markSignedOut()
                    case .restoring, .restoreUnavailable:
                        break
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active, session.phase == .signedIn else { return }
                    Task { await OrdersWidgetUpdater.refresh(using: session) }
                }
        }
    }
}
