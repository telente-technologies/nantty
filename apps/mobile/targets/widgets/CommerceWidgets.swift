import SwiftUI
import WidgetKit

struct OrdersEntry: TimelineEntry {
  let date: Date
  let state: WidgetState<OrderWidgetPayload>
}

struct OrdersProvider: TimelineProvider {
  func placeholder(in context: Context) -> OrdersEntry { OrdersEntry(date: Date(), state: .unavailable) }
  func getSnapshot(in context: Context, completion: @escaping (OrdersEntry) -> Void) {
    Task { completion(OrdersEntry(date: Date(), state: await load())) }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<OrdersEntry>) -> Void) {
    Task { completion(Timeline(entries: [OrdersEntry(date: Date(), state: await load())], policy: .after(WidgetDataSource.nextRefresh()))) }
  }
  private func load() async -> WidgetState<OrderWidgetPayload> {
    await WidgetDataSource.load(kind: "orders", path: "/api/v1/widgets/orders", as: OrderWidgetPayload.self) { payload in payload.orders.compactMap(\.imageUrl) }
  }
}

struct OrdersWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: OrdersEntry
  var body: some View {
    WidgetStateView(title: "Orders", state: entry.state, unavailableMessage: "Open Nantty to refresh.") { payload, _ in
      if let first = payload.orders.first {
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(title: payload.activeCount > 1 ? "\(payload.activeCount) active orders" : "Your order")
          ForEach(family == .systemSmall ? [first] : Array(payload.orders.prefix(3))) { order in
            Link(destination: URL(string: order.deepLink) ?? URL(string: "zudomart://orders")!) {
              VStack(alignment: .leading, spacing: 1) {
                Text(order.statusLabel).font(.subheadline.weight(.bold)).foregroundStyle(ZudoColor.brand).lineLimit(1)
                Text(WidgetFormat.eta(order.etaAt) ?? order.storeName).font(.caption2).foregroundStyle(ZudoColor.muted).lineLimit(1)
                if family == .systemSmall { Text(order.itemTitle).font(.caption).foregroundStyle(ZudoColor.text).lineLimit(2) }
              }
            }
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: family == .systemSmall ? first.deepLink : "zudomart://orders"))
      } else {
        WidgetMessageView(title: "Orders", message: "No active orders right now.").widgetURL(URL(string: "zudomart://orders"))
      }
    }
    .zudoWidgetBackground()
  }
}

struct NanttyOrdersWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZudomartOrdersWidget", provider: OrdersProvider()) { entry in OrdersWidgetView(entry: entry) }
      .configurationDisplayName("Orders")
      .description("Track your active orders and delivery times.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct SellerTodayEntry: TimelineEntry {
  let date: Date
  let state: WidgetState<SellerTodayWidgetPayload>
}

struct SellerTodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> SellerTodayEntry { SellerTodayEntry(date: Date(), state: .unavailable) }
  func getSnapshot(in context: Context, completion: @escaping (SellerTodayEntry) -> Void) {
    Task { completion(SellerTodayEntry(date: Date(), state: await load())) }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SellerTodayEntry>) -> Void) {
    Task { completion(Timeline(entries: [SellerTodayEntry(date: Date(), state: await load())], policy: .after(WidgetDataSource.nextRefresh()))) }
  }
  private func load() async -> WidgetState<SellerTodayWidgetPayload> {
    await WidgetDataSource.load(kind: "sellerToday", path: "/api/v1/widgets/seller-today", moneyWidget: true, as: SellerTodayWidgetPayload.self) { _ in [] }
  }
}

struct SellerTodayWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SellerTodayEntry
  var body: some View {
    WidgetStateView(title: "Sales today", state: entry.state, unavailableMessage: "Open a store to see today's sales.") { payload, _ in
      VStack(alignment: .leading, spacing: 8) {
        WidgetHeader(title: payload.storeName.isEmpty ? "Sales today" : payload.storeName)
        WidgetStatView(label: "Sales today", value: WidgetFormat.amount(payload.salesToday, hidden: payload.amountsHidden))
        HStack {
          WidgetStatView(label: "To ship", value: String(payload.ordersToShip))
          if family != .systemSmall {
            WidgetStatView(label: "Orders today", value: String(payload.ordersToday))
            WidgetStatView(label: "Available", value: WidgetFormat.amount(payload.availableBalance, hidden: payload.amountsHidden))
          }
        }
      }
      .widgetURL(URL(string: payload.deepLink))
    }
    .zudoWidgetBackground()
  }
}

struct NanttySellerTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZudomartSellerTodayWidget", provider: SellerTodayProvider()) { entry in SellerTodayWidgetView(entry: entry) }
      .configurationDisplayName("Sales today")
      .description("Today's sales, orders to ship and your available balance.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
