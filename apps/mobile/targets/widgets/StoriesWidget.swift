import SwiftUI
import WidgetKit

struct StoriesEntry: TimelineEntry {
  let date: Date
  let state: WidgetState<StoriesWidgetPayload>
}

struct StoriesProvider: TimelineProvider {
  func placeholder(in context: Context) -> StoriesEntry { StoriesEntry(date: Date(), state: .unavailable) }
  func getSnapshot(in context: Context, completion: @escaping (StoriesEntry) -> Void) {
    Task { completion(StoriesEntry(date: Date(), state: await load())) }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<StoriesEntry>) -> Void) {
    Task { completion(Timeline(entries: [StoriesEntry(date: Date(), state: await load())], policy: .after(WidgetDataSource.nextRefresh()))) }
  }
  private func load() async -> WidgetState<StoriesWidgetPayload> {
    await WidgetDataSource.load(kind: "stories", path: "/api/v1/widgets/stories", as: StoriesWidgetPayload.self) { payload in payload.people.prefix(8).compactMap(\.avatarUrl) }
  }
}

struct StoriesWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: StoriesEntry

  private var visibleCount: Int {
    switch family {
    case .systemSmall: return 1
    case .systemLarge: return 8
    default: return 4
    }
  }

  var body: some View {
    WidgetStateView(title: "Stories", state: entry.state, unavailableMessage: "Open Zudomart to refresh.") { payload, images in
      let people = Array(payload.people.prefix(visibleCount))
      if let first = people.first {
        if family == .systemSmall {
          VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "Stories")
            Spacer(minLength: 0)
            WidgetAvatarView(imageData: first.avatarUrl.flatMap { images[$0] }, size: 56, ring: first.hasUnseen ? ZudoColor.brand : ZudoColor.seenRing)
            Text(first.name).font(.footnote.weight(.semibold)).foregroundStyle(ZudoColor.text).lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .widgetURL(URL(string: first.deepLink))
        } else {
          VStack(alignment: .leading, spacing: 10) {
            WidgetHeader(title: "Stories")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 10) {
              ForEach(people) { person in
                Link(destination: URL(string: person.deepLink) ?? URL(string: "zudomart://")!) {
                  VStack(spacing: 4) {
                    WidgetAvatarView(imageData: person.avatarUrl.flatMap { images[$0] }, size: 46, ring: person.hasUnseen ? ZudoColor.brand : ZudoColor.seenRing)
                    Text(person.name).font(.caption2).foregroundStyle(ZudoColor.text).lineLimit(1)
                  }
                }
              }
            }
            Spacer(minLength: 0)
          }
        }
      } else {
        WidgetMessageView(title: "Stories", message: "No new stories from people you follow.")
      }
    }
    .zudoWidgetBackground()
  }
}

struct ZudomartStoriesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZudomartStoriesWidget", provider: StoriesProvider()) { entry in StoriesWidgetView(entry: entry) }
      .configurationDisplayName("Stories")
      .description("New stories from people you follow, unseen first.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
