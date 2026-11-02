import SwiftUI

private enum Destination: String, CaseIterable, Identifiable {
    case home = "Nantty"
    case settings = "Settings"

    var id: String { rawValue }
    var symbol: String { self == .home ? "house" : "gearshape" }
}

struct AppShell: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selection: Destination? = .home

    var body: some View {
        NavigationSplitView {
            List(Destination.allCases, selection: $selection) { destination in
                Label(destination.rawValue, systemImage: destination.symbol)
                    .tag(destination as Destination?)
            }
            .navigationTitle("Nantty")
        } detail: {
            NavigationStack {
                Group {
                    switch selection ?? .home {
                    case .home:
                        LandingView()
                    case .settings:
                        APISettingsView()
                    }
                }
                .frame(maxWidth: horizontalSizeClass == .regular ? 720 : .infinity)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .navigationTitle(selection?.rawValue ?? Destination.home.rawValue)
                .navigationBarTitleDisplayMode(.inline)
            }
        }
        .navigationSplitViewStyle(.automatic)
    }
}

private struct LandingView: View {
    var body: some View {
        ContentUnavailableView {
            Label("Nantty", systemImage: "sparkles")
        } description: {
            Text("A social network and marketplace for African buyers, sellers, and creators.")
        }
        .padding()
        .accessibilityElement(children: .contain)
    }
}
