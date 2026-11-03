import SwiftUI
import WidgetKit

private struct OrdersWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: OrdersWidgetSnapshot
}

private struct OrdersWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> OrdersWidgetEntry {
        OrdersWidgetEntry(date: .now, snapshot: .unavailable())
    }

    func getSnapshot(in context: Context, completion: @escaping (OrdersWidgetEntry) -> Void) {
        completion(OrdersWidgetEntry(date: .now, snapshot: currentSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OrdersWidgetEntry>) -> Void) {
        let now = Date.now
        let entry = OrdersWidgetEntry(date: now, snapshot: currentSnapshot())
        completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(30 * 60))))
    }

    private func currentSnapshot() -> OrdersWidgetSnapshot {
        OrdersWidgetSnapshotStore.load() ?? .unavailable()
    }
}

private struct OrdersWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: OrdersWidgetEntry

    var body: some View {
        Group {
            switch entry.snapshot.state {
            case .signedOut:
                message("Sign in to see your orders.", symbol: "person.crop.circle")
                    .widgetURL(NanttyWidgetDeepLink.ordersURL)
            case .unavailable:
                message("Open Nantty to refresh your orders.", symbol: "arrow.clockwise")
                    .widgetURL(NanttyWidgetDeepLink.ordersURL)
            case .ready where entry.snapshot.orders.isEmpty:
                message("No active orders right now.", symbol: "shippingbox")
                    .widgetURL(NanttyWidgetDeepLink.ordersURL)
            case .ready:
                ordersContent
            }
        }
        .containerBackground(.background, for: .widget)
        .privacySensitive()
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens Nantty to your orders")
    }

    private var ordersContent: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Label("Orders", systemImage: "shippingbox")
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 2)
                Text("\(entry.snapshot.activeCount) active")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            ForEach(Array(entry.snapshot.orders.prefix(family == .systemSmall ? 1 : 3))) { order in
                if let destination = order.deepLink {
                    Link(destination: destination) {
                        orderRow(order)
                    }
                    .buttonStyle(.plain)
                } else {
                    orderRow(order)
                }
            }

            if entry.snapshot.refreshFailed {
                Label("Couldn't refresh", systemImage: "exclamationmark.triangle")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else if entry.snapshot.isStale {
                Label("May be out of date", systemImage: "clock")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
        .widgetURL(NanttyWidgetDeepLink.ordersURL)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        let freshness = entry.snapshot.isStale ? "This information may be out of date." : ""
        return "\(entry.snapshot.activeCount) active orders. \(freshness) Open Nantty to view orders."
    }

    private func orderRow(_ order: OrdersWidgetOrder) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(order.statusLabel.isEmpty ? "Order update" : order.statusLabel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.tint)
                .lineLimit(1)
            Text(order.itemTitle.isEmpty ? order.storeName : order.itemTitle)
                .font(.caption)
                .foregroundStyle(.primary)
                .lineLimit(family == .systemSmall ? 2 : 1)
            HStack(spacing: 4) {
                Text(order.reference)
                if let eta = order.etaAt {
                    Text("·")
                    Text(eta, style: .relative)
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, family == .systemSmall ? 5 : 2)
        .contentShape(Rectangle())
    }

    private func message(_ text: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Nantty Orders", systemImage: symbol)
                .font(.caption.weight(.semibold))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.vertical, 2)
    }
}

struct NanttyOrdersWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NanttyOrdersWidget", provider: OrdersWidgetProvider()) { entry in
            OrdersWidgetView(entry: entry)
        }
        .configurationDisplayName("Orders")
        .description("A private glance at your active orders.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
