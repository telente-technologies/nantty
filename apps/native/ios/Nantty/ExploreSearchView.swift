import SwiftUI

struct ExploreSearchView: View {
    @Environment(SessionModel.self) private var session
    @AppStorage("apiBaseURL") private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    let onOpenPost: (String) -> Void
    let onOpenProfile: (String) -> Void

    @State private var query = ""
    @State private var posts: [SearchPostResult] = []
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var loadError: String?
    @State private var pageError: String?
    @State private var requestID = UUID()

    private var normalizedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var contentState: SearchContentState {
        SearchContentState.resolve(queryIsEmpty: normalizedQuery.isEmpty, isLoading: isLoading, hasError: loadError != nil, hasResults: !posts.isEmpty)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search posts", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .accessibilityIdentifier("explore-search-field")
                if !query.isEmpty {
                    Button("Clear", systemImage: "xmark.circle.fill") { query = "" }
                        .labelStyle(.iconOnly)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal)
            .padding(.vertical, 10)

            switch contentState {
            case .idle:
                ContentUnavailableView {
                    Label("Explore Nantty", systemImage: "magnifyingglass")
                } description: {
                    Text("Search public posts by keyword or hashtag.")
                }
            case .loading:
                ProgressView("Searching posts…").frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityIdentifier("explore-search-loading")
            case .error:
                ContentUnavailableView {
                    Label("Search unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(loadError ?? "Please try again.")
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") { Task { await loadFirstPage(query: normalizedQuery) } }
                        .accessibilityIdentifier("explore-search-retry")
                }
            case .empty:
                ContentUnavailableView.search(text: normalizedQuery)
                    .accessibilityIdentifier("explore-search-empty")
            case .results:
                resultsList
            }
        }
        .task(id: normalizedQuery) {
            guard !normalizedQuery.isEmpty else { return }
            let requestedQuery = normalizedQuery
            do { try await Task.sleep(for: .milliseconds(300)) } catch { return }
            await loadFirstPage(query: requestedQuery)
        }
        .onChange(of: query) { _, _ in resetSearch() }
        .onChange(of: session.phase) { _, _ in
            guard !normalizedQuery.isEmpty else { return }
            requestID = UUID()
            Task { await loadFirstPage(query: normalizedQuery) }
        }
        .accessibilityIdentifier("explore-search")
    }

    private var resultsList: some View {
        List {
            Section("Posts") {
                ForEach(posts) { post in
                    HStack(alignment: .top, spacing: 8) {
                        Button { onOpenPost(post.id) } label: { SearchPostRow(post: post) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("search-post-\(post.id)")
                        Button { onOpenProfile(post.authorId) } label: {
                            Image(systemName: "person.crop.circle")
                                .font(.title3)
                                .foregroundStyle(.secondary)
                                .frame(width: 44, height: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("View author profile")
                        .accessibilityIdentifier("search-author-profile-\(post.id)")
                    }
                }
                if let pageError {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(pageError).font(.footnote).foregroundStyle(.secondary)
                        Button("Retry loading more") { Task { await loadMore() } }
                    }
                    .listRowSeparator(.hidden)
                } else if isLoadingMore {
                    ProgressView("Loading more posts…").frame(maxWidth: .infinity).listRowSeparator(.hidden)
                } else if nextCursor != nil {
                    Button("Load more posts", systemImage: "arrow.down") { Task { await loadMore() } }
                        .frame(maxWidth: .infinity).listRowSeparator(.hidden)
                }
            }
            if let loadError {
                Label(loadError, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote).foregroundStyle(.secondary).listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .refreshable { await loadFirstPage(query: normalizedQuery) }
    }

    @MainActor
    private func resetSearch() {
        posts = []
        nextCursor = nil
        loadError = nil
        pageError = nil
        isLoading = false
        isLoadingMore = false
        requestID = UUID()
    }

    @MainActor
    private func loadFirstPage(query requestedQuery: String) async {
        guard requestedQuery == normalizedQuery, !requestedQuery.isEmpty else { return }
        let id = requestID
        isLoading = true
        loadError = nil
        pageError = nil
        do {
            let page = try await session.searchPosts(baseURL: apiBaseURL, query: requestedQuery)
            guard id == requestID, requestedQuery == normalizedQuery else { return }
            posts = page.data
            nextCursor = page.nextCursor
        } catch {
            guard id == requestID, requestedQuery == normalizedQuery else { return }
            loadError = error.localizedDescription
        }
        if id == requestID { isLoading = false }
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, !isLoadingMore, let cursor = nextCursor, !normalizedQuery.isEmpty else { return }
        let id = requestID
        let requestedQuery = normalizedQuery
        isLoadingMore = true
        pageError = nil
        do {
            let page = try await session.searchPosts(baseURL: apiBaseURL, query: requestedQuery, cursor: cursor)
            guard id == requestID, requestedQuery == normalizedQuery else { return }
            posts = SearchPostsPage.appending(page.data, to: posts)
            nextCursor = page.nextCursor
        } catch {
            guard id == requestID, requestedQuery == normalizedQuery else { return }
            pageError = error.localizedDescription
        }
        if id == requestID { isLoadingMore = false }
    }
}

private struct SearchPostRow: View {
    let post: SearchPostResult

    var body: some View {
        HStack(spacing: 12) {
            if let thumbnailUrl = post.thumbnailUrl {
                AsyncImage(url: thumbnailUrl) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else if phase.error != nil { Image(systemName: "photo").foregroundStyle(.secondary) }
                    else { ProgressView() }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .accessibilityLabel("Post image")
            } else {
                Image(systemName: "text.alignleft")
                    .font(.title3).foregroundStyle(.secondary)
                    .frame(width: 64, height: 64)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(post.caption.isEmpty ? "Post" : post.caption)
                    .font(.body).lineLimit(3).multilineTextAlignment(.leading)
                Label("\(post.likes.formatted()) likes · \(post.views.formatted()) views", systemImage: "heart")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .padding(.vertical, 5)
    }
}
