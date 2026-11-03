import SwiftUI
import WidgetKit

private struct NanttyQuickActionsEntry: TimelineEntry {
    let date: Date
}

private struct NanttyQuickActionsProvider: TimelineProvider {
    func placeholder(in context: Context) -> NanttyQuickActionsEntry {
        NanttyQuickActionsEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (NanttyQuickActionsEntry) -> Void) {
        completion(NanttyQuickActionsEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NanttyQuickActionsEntry>) -> Void) {
        let entry = NanttyQuickActionsEntry(date: .now)
        completion(Timeline(entries: [entry], policy: .after(Date.now.addingTimeInterval(6 * 60 * 60))))
    }
}

private struct NanttyQuickAction: Identifiable {
    let title: String
    let symbol: String
    let destination: URL

    var id: String { title }

    static let all: [NanttyQuickAction] = [
        NanttyQuickAction(title: "Feed", symbol: "house.fill", destination: NanttyWidgetDeepLink.feedURL),
        NanttyQuickAction(title: "New post", symbol: "square.and.pencil", destination: NanttyWidgetDeepLink.createPostURL),
        NanttyQuickAction(title: "Wallet", symbol: "wallet.bifold", destination: NanttyWidgetDeepLink.walletURL),
        NanttyQuickAction(title: "Messages", symbol: "bubble.left.and.bubble.right.fill", destination: NanttyWidgetDeepLink.messagesURL)
    ]
}

private struct NanttyQuickActionsView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    private var accent: Color {
        colorScheme == .dark
            ? Color(red: 174.0 / 255.0, green: 187.0 / 255.0, blue: 1)
            : Color(red: 32.0 / 255.0, green: 67.0 / 255.0, blue: 245.0 / 255.0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nantty")
                .font(.headline.weight(.bold))
                .foregroundStyle(.primary)
                .accessibilityAddTraits(.isHeader)

            if family == .systemSmall {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(NanttyQuickAction.all) { action in
                        actionLink(action, compact: true)
                    }
                }
            } else {
                HStack(spacing: 8) {
                    ForEach(NanttyQuickAction.all) { action in
                        actionLink(action, compact: false)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .containerBackground(.background, for: .widget)
        .widgetURL(NanttyWidgetDeepLink.feedURL)
    }

    private func actionLink(_ action: NanttyQuickAction, compact: Bool) -> some View {
        Link(destination: action.destination) {
            VStack(spacing: compact ? 4 : 7) {
                Image(systemName: action.symbol)
                    .font(.system(size: compact ? 17 : 20, weight: .semibold))
                    .foregroundStyle(accent)
                    .accessibilityHidden(true)
                Text(action.title)
                    .font(compact ? .caption2.weight(.medium) : .caption.weight(.medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, minHeight: compact ? 42 : 68)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.title)
        .accessibilityHint("Opens \(action.title.lowercased()) in Nantty")
    }
}

struct NanttyQuickActionsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NanttyQuickActions", provider: NanttyQuickActionsProvider()) { _ in
            NanttyQuickActionsView()
        }
        .configurationDisplayName("Nantty Quick Actions")
        .description("Jump to your feed, create a post, open Wallet or view messages.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
