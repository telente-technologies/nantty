import SwiftUI
import WidgetKit

private struct NanttyEntry: TimelineEntry {
    let date: Date
}

private struct NanttyProvider: TimelineProvider {
    func placeholder(in context: Context) -> NanttyEntry {
        NanttyEntry(date: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (NanttyEntry) -> Void) {
        completion(NanttyEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NanttyEntry>) -> Void) {
        let now = Date.now
        let nextDay = Calendar.current.date(
            byAdding: .day,
            value: 1,
            to: Calendar.current.startOfDay(for: now)
        ) ?? now.addingTimeInterval(24 * 60 * 60)

        completion(Timeline(entries: [NanttyEntry(date: now)], policy: .after(nextDay)))
    }
}

private enum NanttyWidgetStyle {
    static let blue = Color(red: 32.0 / 255.0, green: 67.0 / 255.0, blue: 245.0 / 255.0)
    static let blueOnDark = Color(red: 174.0 / 255.0, green: 187.0 / 255.0, blue: 1)

    static func accent(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? blueOnDark : blue
    }
}

private struct NanttyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    let entry: NanttyEntry

    private var accent: Color { NanttyWidgetStyle.accent(for: colorScheme) }

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                smallLayout
            case .systemLarge, .systemExtraLarge:
                largeLayout
            case .accessoryInline:
                inlineLockScreenLayout
            case .accessoryCircular:
                circularLockScreenLayout
            case .accessoryRectangular:
                lockScreenLayout
            default:
                mediumLayout
            }
        }
        .containerBackground(.background, for: .widget)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens Nantty to your For You feed")
    }

    private var smallLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                brandMark(size: 38)
                Spacer(minLength: 8)
                Text(entry.date, format: .dateTime.month(.abbreviated).day())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 10)

            VStack(alignment: .leading, spacing: 3) {
                Text("Your people,")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundStyle(.primary)
                Text("your marketplace.")
                    .font(.system(.subheadline, design: .rounded, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer(minLength: 10)
            openFeedLabel
        }
        .padding(16)
        .accessibilityLabel("Nantty. Your people, your marketplace. Open the For You feed.")
    }

    private var mediumLayout: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 9) {
                    brandMark(size: 34)
                    Text("Nantty")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(.primary)
                }

                Spacer(minLength: 12)

                Text("A closer look at what matters.")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("People, posts and shops—all in one place.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)

                Spacer(minLength: 12)
                openFeedLabel
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 12) {
                featureRow("Feed", symbol: "text.bubble")
                featureRow("Shops", symbol: "storefront")
                featureRow("Messages", symbol: "bubble.left.and.bubble.right")
            }
            .padding(.leading, 16)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(.quaternary)
                    .frame(width: 1)
            }
        }
        .padding(18)
        .accessibilityLabel("Nantty. Your people, posts, shops and messages. Open the For You feed.")
    }

    private var largeLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                brandMark(size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nantty")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(.primary)
                    Text(entry.date, format: .dateTime.weekday(.wide).month(.abbreviated).day())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(accent)
                    .accessibilityHidden(true)
            }

            Spacer(minLength: 18)

            Text("Your community,\nall in one place.")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            Text("Catch up with people, discover shops and join the conversation.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            Spacer(minLength: 18)

            HStack(spacing: 8) {
                featurePill("Connect", symbol: "person.2")
                featurePill("Discover", symbol: "sparkle.magnifyingglass")
                featurePill("Shop", symbol: "bag")
            }

            Spacer(minLength: 16)
            openFeedLabel
        }
        .padding(20)
        .accessibilityLabel("Nantty. Your community, all in one place. Connect, discover and shop. Open the For You feed.")
    }

    private var lockScreenLayout: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.headline)
                .foregroundStyle(NanttyWidgetStyle.blue)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("Nantty")
                    .font(.headline.weight(.semibold))
                Text("Open your feed")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .accessibilityLabel("Nantty. Open your For You feed.")
    }

    private var inlineLockScreenLayout: some View {
        Label("Open Nantty", systemImage: "bubble.left.and.bubble.right.fill")
            .accessibilityLabel("Open Nantty to your For You feed")
    }

    private var circularLockScreenLayout: some View {
        Image(systemName: "bubble.left.and.bubble.right.fill")
            .font(.title3.weight(.semibold))
            .foregroundStyle(accent)
            .accessibilityLabel("Open Nantty to your For You feed")
    }

    private var openFeedLabel: some View {
        HStack(spacing: 6) {
            Text("OPEN NANTTY")
                .font(.caption2.weight(.bold))
                .tracking(0.7)
            Image(systemName: "arrow.right")
                .font(.caption2.weight(.bold))
                .accessibilityHidden(true)
        }
        .foregroundStyle(accent)
        .accessibilityHidden(true)
    }

    private func brandMark(size: CGFloat) -> some View {
        Image(systemName: "bubble.left.and.bubble.right.fill")
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background {
                RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
                    .fill(NanttyWidgetStyle.blue.gradient)
            }
            .accessibilityHidden(true)
    }

    private func featureRow(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }

    private func featurePill(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .foregroundStyle(accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(accent.opacity(0.12), in: Capsule())
    }
}

struct NanttyHomeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NanttyOverview", provider: NanttyProvider()) { entry in
            NanttyWidgetView(entry: entry)
        }
        .configurationDisplayName("Nantty Home")
        .description("A one-tap way back to your Nantty feed.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .systemExtraLarge,
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}
