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
                        ForYouFeedView()
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

private struct ForYouFeedView: View {
    @AppStorage("apiBaseURL")
    private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    @State private var posts: [FeedPost] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var reloadID = UUID()

    var body: some View {
        Group {
            if isLoading && posts.isEmpty {
                ProgressView("Loading your feed…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, posts.isEmpty {
                ContentUnavailableView {
                    Label("Feed unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") { reloadID = UUID() }
                }
            } else if posts.isEmpty {
                ContentUnavailableView("No posts yet", systemImage: "text.bubble", description: Text("Check back later for new posts."))
            } else {
                List(posts) { post in
                    FeedPostRow(post: post)
                        .listRowSeparator(.visible)
                }
                .listStyle(.plain)
                .refreshable { await loadFeed() }
                .overlay(alignment: .top) {
                    if isLoading {
                        ProgressView().padding(.top, 8)
                    } else if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .padding(10)
                            .frame(maxWidth: .infinity)
                            .background(.bar)
                    }
                }
            }
        }
        .task(id: reloadID) { await loadFeed() }
        .accessibilityIdentifier("for-you-feed")
    }

    @MainActor
    private func loadFeed() async {
        isLoading = true
        errorMessage = nil
        do {
            posts = try await FeedService(baseURL: apiBaseURL).fetchForYou()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct FeedPostRow: View {
    let post: FeedPost

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Group {
                    if let avatarURL = post.displayAvatarUrl {
                        AsyncImage(url: avatarURL) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                avatarFallback
                            }
                        }
                    } else {
                        avatarFallback
                    }
                }
                .frame(width: 42, height: 42)
                .clipShape(Circle())
                .accessibilityLabel("Profile photo for \(post.displayName)")

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(post.displayName)
                            .font(.headline)
                            .lineLimit(1)
                            .accessibilityLabel("Author: \(post.displayName)")
                        if let badgeColor = post.author.visibleBadgeColor {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundStyle(color(for: badgeColor))
                                .accessibilityLabel(badgeLabel(for: badgeColor))
                        }
                    }
                    Text("@\(post.displayHandle)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Text(post.text)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel("Post: \(post.text)")
            ForEach(post.media.filter { $0.previewUrl != nil }) { media in
                if let previewURL = media.previewUrl {
                    AsyncImage(url: previewURL) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFit()
                        } else if phase.error != nil {
                            Label(media.type == "video" ? "Video preview unavailable" : "Image unavailable", systemImage: "photo")
                                .frame(maxWidth: .infinity, minHeight: 120)
                                .foregroundStyle(.secondary)
                        } else {
                            ProgressView("Loading media…")
                                .frame(maxWidth: .infinity, minHeight: 120)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .bottomLeading) {
                        if media.type == "video" {
                            Label("Video", systemImage: "play.fill")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(.ultraThinMaterial, in: Capsule())
                                .padding(10)
                        }
                    }
                    .accessibilityLabel(media.type == "video" ? "Video preview" : "Attached image")
                }
            }
            HStack(spacing: 22) {
                engagement("heart", count: post.likes, label: "likes")
                engagement("bubble", count: post.comments, label: "comments")
                engagement("arrow.2.squarepath", count: post.reposts, label: "reposts")
                engagement("square.and.arrow.up", count: post.shares, label: "shares")
            }
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var avatarFallback: some View {
        Circle()
            .fill(Color(uiColor: .secondarySystemBackground))
            .overlay {
                Text(String(post.displayName.prefix(1)).uppercased())
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
    }

    private func engagement(_ symbol: String, count: Int, label: String) -> some View {
        Label(count.formatted(), systemImage: symbol)
            .font(.footnote)
            .accessibilityLabel("\(count) \(label)")
    }

    private func badgeLabel(for color: String) -> String {
        switch color {
        case "gold": return "Verified business"
        case "black": return "Official government account"
        default: return "Verified account"
        }
    }

    private func color(for badge: String) -> Color {
        switch badge {
        case "gold": return Color(red: 183.0 / 255.0, green: 121.0 / 255.0, blue: 31.0 / 255.0)
        case "black": return .primary
        default: return Color(red: 32.0 / 255.0, green: 67.0 / 255.0, blue: 245.0 / 255.0)
        }
    }
}
