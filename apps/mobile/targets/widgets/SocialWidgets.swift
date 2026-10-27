import SwiftUI
import WidgetKit

struct LiveNowEntry: TimelineEntry {
  let date: Date
  let state: WidgetState<LiveNowWidgetPayload>
}

struct LiveNowProvider: TimelineProvider {
  func placeholder(in context: Context) -> LiveNowEntry { LiveNowEntry(date: Date(), state: .unavailable) }
  func getSnapshot(in context: Context, completion: @escaping (LiveNowEntry) -> Void) {
    Task { completion(LiveNowEntry(date: Date(), state: await load())) }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<LiveNowEntry>) -> Void) {
    Task { completion(Timeline(entries: [LiveNowEntry(date: Date(), state: await load())], policy: .after(WidgetDataSource.nextRefresh()))) }
  }
  private func load() async -> WidgetState<LiveNowWidgetPayload> {
    await WidgetDataSource.load(kind: "liveNow", path: "/api/v1/widgets/live-now", as: LiveNowWidgetPayload.self) { payload in payload.lives.prefix(3).compactMap(\.hostAvatarUrl) }
  }
}

struct LiveNowWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: LiveNowEntry
  var body: some View {
    WidgetStateView(title: "Live now", state: entry.state, unavailableMessage: "Open Nantty to refresh.") { payload, images in
      if let first = payload.lives.first {
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(title: "Live now")
          ForEach(Array(payload.lives.prefix(family == .systemSmall ? 1 : 3))) { live in
            Link(destination: URL(string: live.deepLink) ?? URL(string: "nantty://")!) {
              HStack(spacing: 8) {
                WidgetAvatarView(imageData: live.hostAvatarUrl.flatMap { images[$0] }, size: family == .systemSmall ? 40 : 30, ring: NanttyColor.live)
                VStack(alignment: .leading, spacing: 1) {
                  Text(live.hostName).font(.footnote.weight(.bold)).foregroundStyle(NanttyColor.text).lineLimit(1)
                  Text("\(WidgetFormat.compact(live.viewers)) watching").font(.caption2).foregroundStyle(NanttyColor.muted).lineLimit(1)
                }
              }
            }
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(URL(string: first.deepLink))
      } else {
        WidgetMessageView(title: "Live now", message: "No one you follow is live.")
      }
    }
    .nanttyWidgetBackground()
  }
}

struct NanttyLiveNowWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NanttyLiveNowWidget", provider: LiveNowProvider()) { entry in LiveNowWidgetView(entry: entry) }
      .configurationDisplayName("Live now")
      .description("Creators you follow who are live right now.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct CreatorTodayEntry: TimelineEntry {
  let date: Date
  let state: WidgetState<CreatorTodayWidgetPayload>
}

struct CreatorTodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> CreatorTodayEntry { CreatorTodayEntry(date: Date(), state: .unavailable) }
  func getSnapshot(in context: Context, completion: @escaping (CreatorTodayEntry) -> Void) {
    Task { completion(CreatorTodayEntry(date: Date(), state: await load())) }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<CreatorTodayEntry>) -> Void) {
    Task { completion(Timeline(entries: [CreatorTodayEntry(date: Date(), state: await load())], policy: .after(WidgetDataSource.nextRefresh()))) }
  }
  private func load() async -> WidgetState<CreatorTodayWidgetPayload> {
    await WidgetDataSource.load(kind: "creatorToday", path: "/api/v1/widgets/creator-today", moneyWidget: true, as: CreatorTodayWidgetPayload.self) { _ in [] }
  }
}

struct CreatorTodayWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: CreatorTodayEntry
  var body: some View {
    WidgetStateView(title: "Creator stats", state: entry.state, unavailableMessage: "Open Nantty to refresh.") { payload, _ in
      if payload.creatorProgramMember {
        VStack(alignment: .leading, spacing: 8) {
          WidgetHeader(title: "Today")
          WidgetStatView(label: "Views", value: WidgetFormat.compact(payload.viewsToday))
          HStack {
            WidgetStatView(label: "New followers", value: WidgetFormat.compact(payload.newFollowersToday))
            if family != .systemSmall { WidgetStatView(label: "Earnings", value: WidgetFormat.amount(payload.earningsToday, hidden: payload.amountsHidden)) }
          }
        }
        .widgetURL(URL(string: payload.deepLink))
      } else {
        WidgetMessageView(title: "Creator stats", message: "Join the Creator Program to see your stats.").widgetURL(URL(string: payload.deepLink))
      }
    }
    .nanttyWidgetBackground()
  }
}

struct NanttyCreatorTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NanttyCreatorTodayWidget", provider: CreatorTodayProvider()) { entry in CreatorTodayWidgetView(entry: entry) }
      .configurationDisplayName("Creator stats")
      .description("Today's views, new followers and earnings.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
