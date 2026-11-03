import SwiftUI

struct SavedPostsView: View {
    @Environment(SessionModel.self) private var session

    let onOpenPost: (String) -> Void
    let onSignInRequired: () -> Void

    @State private var posts: [SavedPostItem] = []
    @State private var nextCursor: String?
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var paginationError: String?
    @State private var requestGeneration = UUID()

    private let columns = [GridItem(.adaptive(minimum: 148), spacing: 2, alignment: .top)]

    var body: some View {
        Group {
            switch session.phase {
            case .restoring:
                ProgressView("Checking your account…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .restoreUnavailable:
                ContentUnavailableView {
                    Label("Saved posts unavailable", systemImage: "bookmark")
                } description: {
                    Text(session.message ?? "Your account session could not be restored.")
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") { Task { await session.restoreSession() } }
                }
            case .signedOut:
                ContentUnavailableView {
                    Label("Sign in to view saved posts", systemImage: "bookmark")
                } description: {
                    Text("Posts you save are private to your account.")
                } actions: {
                    Button("Sign In", systemImage: "person.crop.circle", action: onSignInRequired)
                        .accessibilityIdentifier("saved-posts-sign-in")
                }
            case .signedIn:
                savedContent
            }
        }
        .navigationTitle("Saved Posts")
        .task(id: session.phase) {
            guard session.phase == .signedIn else { return }
            await loadFirstPage()
        }
        .accessibilityIdentifier("saved-posts-screen")
    }

    @ViewBuilder
    private var savedContent: some View {
        if isLoading && posts.isEmpty {
            ProgressView("Loading saved posts…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage, posts.isEmpty {
            ContentUnavailableView {
                Label("Couldn’t load saved posts", systemImage: "wifi.exclamationmark")
            } description: {
                Text(errorMessage)
            } actions: {
                Button("Try Again", systemImage: "arrow.clockwise") { Task { await loadFirstPage() } }
                    .accessibilityIdentifier("saved-posts-retry")
            }
        } else if posts.isEmpty {
            ContentUnavailableView("No saved posts", systemImage: "bookmark", description: Text("Posts you bookmark will appear here. Only you can see them."))
        } else {
            ScrollView {
                if let errorMessage {
                    retryBanner(errorMessage, action: { Task { await loadFirstPage() } }, identifier: "saved-posts-refresh-retry")
                }
                Text("Posts only. Saved videos, clips, products, and replies aren’t included yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .accessibilityIdentifier("saved-posts-scope-note")
                LazyVGrid(columns: columns, spacing: 2) {
                    ForEach(posts.filter { $0.type == "post" }) { item in
                        Button { onOpenPost(item.targetId) } label: { SavedPostTile(item: item) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(accessibilityLabel(for: item))
                            .accessibilityHint("Opens the saved post and its replies")
                            .accessibilityIdentifier("saved-post-\(item.id)")
                    }
                }
                .padding(.horizontal, 2)

                if let paginationError {
                    retryBanner(paginationError, action: { Task { await loadMore() } }, identifier: "saved-posts-load-more-retry")
                } else if isLoadingMore {
                    ProgressView("Loading more saved posts…")
                        .padding()
                        .accessibilityIdentifier("saved-posts-load-more-progress")
                } else if nextCursor != nil {
                    Button("Load more saved posts", systemImage: "arrow.down") { Task { await loadMore() } }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .accessibilityIdentifier("saved-posts-load-more")
                } else {
                    Text("You’ve reached the end of your saved posts")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding()
                        .accessibilityIdentifier("saved-posts-pagination-end")
                }
            }
            .refreshable { await loadFirstPage() }
            .overlay(alignment: .top) {
                if isLoading && !posts.isEmpty { ProgressView().padding(.top, 8) }
            }
        }
    }

    private func retryBanner(_ message: String, action: @escaping () -> Void, identifier: String) -> some View {
        HStack {
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .font(.footnote)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button("Retry", action: action).font(.footnote.weight(.semibold))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.bar)
        .accessibilityIdentifier(identifier)
    }

    private func accessibilityLabel(for item: SavedPostItem) -> String {
        let author = item.preview.author.map { " by @\($0)" } ?? ""
        let title = item.preview.title.map { ": \($0)" } ?? ""
        return "Saved post\(author)\(title)"
    }

    @MainActor
    private func loadFirstPage() async {
        guard session.phase == .signedIn else { return }
        let requestID = UUID()
        requestGeneration = requestID
        isLoading = true
        isLoadingMore = false
        errorMessage = nil
        paginationError = nil
        do {
            let page = try await session.fetchSavedPosts()
            guard requestGeneration == requestID else { return }
            posts = page.data.filter { $0.type == "post" }
            nextCursor = page.nextCursor
        } catch {
            guard requestGeneration == requestID else { return }
            errorMessage = error.localizedDescription
        }
        if requestGeneration == requestID { isLoading = false }
    }

    @MainActor
    private func loadMore() async {
        guard session.phase == .signedIn, !isLoading, !isLoadingMore,
              let cursor = nextCursor else { return }
        let requestID = requestGeneration
        isLoadingMore = true
        paginationError = nil
        do {
            let page = try await session.fetchSavedPosts(cursor: cursor)
            guard requestGeneration == requestID else { return }
            posts = SavedPostsPage.appending(page.data.filter { $0.type == "post" }, to: posts)
            nextCursor = page.nextCursor
        } catch {
            guard requestGeneration == requestID else { return }
            paginationError = error.localizedDescription
        }
        if requestGeneration == requestID { isLoadingMore = false }
    }

}

private struct SavedPostTile: View {
    let item: SavedPostItem

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                if let thumbnail = item.preview.thumbnailUrl {
                    AsyncImage(url: thumbnail) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else if phase.error != nil {
                            textFallback
                        } else {
                            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                } else {
                    textFallback
                }
                if let author = item.preview.author {
                    Text("@\(author)")
                        .font(.caption.weight(.medium))
                        .lineLimit(1)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(.thinMaterial, in: Capsule())
                        .padding(8)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
            .background(Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .aspectRatio(130.0 / 170.0, contentMode: .fit)
    }

    private var textFallback: some View {
        Text(item.preview.title ?? "Saved post")
            .font(.callout)
            .lineLimit(6)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(10)
            .background(Color(uiColor: .secondarySystemBackground))
    }
}
