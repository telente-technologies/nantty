import SwiftUI
import WidgetKit

private struct NanttyEntry: TimelineEntry {
    let date: Date
    let isAPIConfigured: Bool
}

private struct NanttyProvider: TimelineProvider {
    func placeholder(in context: Context) -> NanttyEntry {
        NanttyEntry(date: .now, isAPIConfigured: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (NanttyEntry) -> Void) {
        completion(NanttyEntry(date: .now, isAPIConfigured: WidgetSharedState.isAPIConfigured))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NanttyEntry>) -> Void) {
        let entry = NanttyEntry(date: .now, isAPIConfigured: WidgetSharedState.isAPIConfigured)
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
}

private struct NanttyWidgetView: View {
    let entry: NanttyEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Nantty", systemImage: "sparkles")
                .font(.headline)
                .foregroundStyle(.tint)
            Text("Social marketplace")
                .font(.subheadline)
                .foregroundStyle(.primary)
            if entry.isAPIConfigured {
                Text("Backend configured")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text("Set a backend in app settings")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(.background, for: .widget)
        .accessibilityElement(children: .combine)
    }
}

@main
struct NanttyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NanttyOverview", provider: NanttyProvider()) { entry in
            NanttyWidgetView(entry: entry)
        }
        .configurationDisplayName("Nantty")
        .description("A simple Nantty overview and backend configuration status.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
