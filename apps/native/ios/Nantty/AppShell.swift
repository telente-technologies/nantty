import SwiftUI

private enum Destination: String, CaseIterable, Identifiable {
    case home = "Nantty"
    case mart = "Mart"
    case explore = "Explore"
    case inbox = "Inbox"
    case orders = "Orders"
    case wallet = "Wallet"
    case notifications = "Notifications"
    case saved = "Saved Posts"
    case create = "Create post"
    case profile = "Profile"
    case account = "Account"
    case settings = "Settings"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house"
        case .mart: "bag"
        case .explore: "magnifyingglass"
        case .inbox: "bubble.left.and.bubble.right"
        case .orders: "shippingbox"
        case .wallet: "wallet.bifold"
        case .notifications: "bell"
        case .saved: "bookmark"
        case .create: "square.and.pencil"
        case .profile: "person.crop.circle"
        case .account: "person.crop.circle"
        case .settings: "gearshape"
        }
    }
}

private enum AppRoute: Hashable {
    case post(String)
    case profile(String)
}

struct AppShell: View {
    @Environment(SessionModel.self) private var session
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selection: Destination? = .home
    @State private var selectedOrderID: String?
    @State private var navigationPath: [AppRoute] = []

    var body: some View {
        NavigationSplitView {
            List(Destination.allCases, selection: $selection) { destination in
                Label(destination.rawValue, systemImage: destination.symbol)
                    .tag(destination as Destination?)
            }
            .navigationTitle("Nantty")
        } detail: {
            NavigationStack(path: $navigationPath) {
                Group {
                    switch selection ?? .home {
                    case .home:
                        ForYouFeedView(selection: $selection, onOpenProfile: openProfile)
                    case .mart:
                        MartBrowserView()
                    case .explore:
                        ExploreSearchView(onOpenPost: openPost, onOpenProfile: openProfile)
                    case .inbox:
                        ConversationInboxView()
                    case .orders:
                        OrdersOverviewView(selectedOrderID: selectedOrderID, onSignInRequired: { selection = .account })
                    case .wallet:
                        WalletOverviewView(onSignInRequired: { selection = .account })
                    case .notifications:
                        NotificationsView(
                            onSignInRequired: { selection = .account },
                            onOpenPost: openPost,
                            onOpenProfile: openProfile
                        )
                    case .saved:
                        SavedPostsView(onOpenPost: openPost, onSignInRequired: { selection = .account })
                    case .create:
                        TextPostComposerView(onPublished: { selection = .home }, onSignInRequired: { selection = .account })
                    case .profile:
                        MyProfileView(onSignInRequired: { selection = .account })
                    case .account:
                        AccountView()
                    case .settings:
                        APISettingsView()
                    }
                }
                .transition(reduceMotion
                    ? .opacity
                    : .asymmetric(
                        insertion: .move(edge: selection == .mart ? .trailing : .leading),
                        removal: .move(edge: selection == .mart ? .leading : .trailing)
                    ))
                .frame(maxWidth: horizontalSizeClass == .regular ? 720 : .infinity)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .navigationTitle(selection?.rawValue ?? Destination.home.rawValue)
                .navigationBarTitleDisplayMode(.inline)
                .animation(reduceMotion ? .linear(duration: 0.1) : .snappy(duration: 0.28), value: selection)
                .toolbar {
                    if selection == .home {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                selection = .mart
                            } label: {
                                Label("Mart", systemImage: "bag")
                            }
                            .accessibilityIdentifier("open-mart-action")
                        }
                        ToolbarItem(placement: .primaryAction) {
                            Button {
                                selection = .create
                            } label: {
                                Label("Create post", systemImage: "square.and.pencil")
                            }
                            .accessibilityIdentifier("create-post-action")
                        }
                    } else if selection == .mart {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                selection = .home
                            } label: {
                                Label("Feed", systemImage: "house")
                            }
                            .accessibilityIdentifier("open-feed-action")
                        }
                    }
                }
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .post(let postID):
                        PostThreadView(postID: postID) {
                            selection = .account
                        }
                    case .profile(let userID):
                        PublicProfileView(userID: userID, onOpenPost: openPost) {
                            selection = .account
                        }
                    }
                }
            }
            .onChange(of: selection) { _, destination in
                if destination != .home { navigationPath = [] }
            }
        }
        .navigationSplitViewStyle(.automatic)
        .onOpenURL(perform: openAppURL)
    }

    private func openAppURL(_ url: URL) {
        guard let destination = NanttyWidgetDeepLink.destination(from: url) else { return }
        navigationPath = []
        switch destination {
        case .feed:
            selection = .home
        case .createPost:
            selection = .create
        case .wallet:
            selection = .wallet
        case .messages:
            selection = .inbox
        case .orders(let orderID):
            selectedOrderID = orderID
            selection = .orders
        }
    }

    private func openPost(_ postID: String) {
        guard let safePostID = NotificationRouting.validatedPostID(postID) else { return }
        selection = .home
        navigationPath = [.post(safePostID)]
    }

    private func openProfile(_ userID: String) {
        guard let safeUserID = PublicProfileAPI.validatedUserID(userID) else { return }
        if session.user?.id == safeUserID {
            selection = .profile
            navigationPath = []
            return
        }
        navigationPath.append(.profile(safeUserID))
    }
}

private struct ForYouFeedView: View {
    @Environment(SessionModel.self) private var session
    @Binding var selection: Destination?
    let onOpenProfile: (String) -> Void
    @AppStorage("apiBaseURL")
    private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    @State private var posts: [FeedPost] = []
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var paginationError: String?
    @State private var nextCursor: String?
    @State private var reloadID = UUID()
    @State private var feedKind: FeedKind = .forYou

    var body: some View {
        VStack(spacing: 0) {
            Picker("Feed", selection: $feedKind) {
                ForEach(FeedKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 10)
            .accessibilityIdentifier("feed-kind-selector")

            Group {
                if feedKind.requiresAuthentication && session.phase != .signedIn {
                    signedOutFollowingContent
                } else if isLoading && posts.isEmpty {
                    ProgressView("Loading \(feedKind.title) feed…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage, posts.isEmpty {
                    ContentUnavailableView {
                        Label("Feed unavailable", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Try Again", systemImage: "arrow.clockwise") { reloadID = UUID() }
                    }
                } else if posts.isEmpty && nextCursor == nil {
                    ContentUnavailableView("No posts yet", systemImage: "text.bubble", description: Text("Check back later for new posts."))
                } else {
                    List {
                        ForEach(posts) { post in
                            FeedPostRow(post: post, onSignInRequired: { selection = .account }, onOpenProfile: onOpenProfile)
                                .listRowSeparator(.visible)
                        }
                        paginationFooter
                    }
                    .listStyle(.plain)
                    .refreshable { await loadFeed() }
                    .overlay(alignment: .top) {
                        if isLoading {
                            ProgressView().padding(.top, 8)
                        } else if let errorMessage {
                            HStack {
                                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                    .font(.footnote)
                                Button("Retry") { Task { await loadFeed() } }
                                    .font(.footnote.weight(.semibold))
                                    .accessibilityHint("Reloads the \(feedKind.title) feed")
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity)
                            .background(.bar)
                        }
                    }
                }
            }
        }
        .task(id: reloadID) { await loadFeed() }
        .onChange(of: feedKind) { _, _ in reloadSelectedFeed() }
        .onChange(of: session.phase) { _, _ in reloadSelectedFeed() }
        .accessibilityIdentifier("for-you-feed")
    }

    @ViewBuilder
    private var signedOutFollowingContent: some View {
        switch session.phase {
        case .restoring:
            ProgressView("Checking your account…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .signedOut:
            ContentUnavailableView {
                Label("Sign in for Following", systemImage: "person.crop.circle.badge.checkmark")
            } description: {
                Text("Following shows posts from accounts you follow.")
            } actions: {
                Button("Sign In", systemImage: "person.crop.circle") { selection = .account }
                    .accessibilityIdentifier("following-sign-in")
            }
        case .restoreUnavailable:
            ContentUnavailableView {
                Label("Session unavailable", systemImage: "person.crop.circle.badge.exclamationmark")
            } description: {
                Text("Open Account to sign in again before viewing Following.")
            } actions: {
                Button("Open Account", systemImage: "person.crop.circle") { selection = .account }
            }
        case .signedIn:
            EmptyView()
        }
    }

    @MainActor
    private func reloadSelectedFeed() {
        posts = []
        nextCursor = nil
        errorMessage = nil
        paginationError = nil
        isLoadingMore = false
        isLoading = true
        reloadID = UUID()
    }

    @ViewBuilder
    private var paginationFooter: some View {
        if let paginationError {
            VStack(spacing: 8) {
                Text(paginationError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("feed-pagination-error")
                Button("Retry loading more posts") { Task { await loadMore() } }
                    .accessibilityHint("Retries loading the next page of your feed")
                    .accessibilityIdentifier("feed-pagination-retry")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .listRowSeparator(.hidden)
        } else if isLoadingMore {
            ProgressView("Loading more posts…")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .accessibilityIdentifier("feed-pagination-loading")
                .listRowSeparator(.hidden)
        } else if nextCursor != nil {
            Button("Load more posts") { Task { await loadMore() } }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .accessibilityHint("Loads the next page of posts")
                .accessibilityIdentifier("feed-load-more")
                .listRowSeparator(.hidden)
        } else {
            Label("You’ve reached the end of your feed", systemImage: "checkmark.circle")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .accessibilityIdentifier("feed-pagination-end")
                .listRowSeparator(.hidden)
        }
    }

    @MainActor
    private func loadFeed() async {
        let requestedFeed = feedKind
        let requestedReloadID = reloadID
        if requestedFeed.requiresAuthentication, session.phase != .signedIn {
            posts = []
            nextCursor = nil
            errorMessage = nil
            isLoading = false
            return
        }
        isLoading = true
        errorMessage = nil
        paginationError = nil
        do {
            let page = try await session.fetchFeed(baseURL: apiBaseURL, kind: requestedFeed)
            guard requestedReloadID == reloadID, requestedFeed == feedKind else { return }
            posts = page.data
            nextCursor = page.nextCursor
        } catch {
            guard requestedReloadID == reloadID, requestedFeed == feedKind else { return }
            errorMessage = error.localizedDescription
        }
        if requestedReloadID == reloadID, requestedFeed == feedKind { isLoading = false }
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, !isLoadingMore, let cursor = nextCursor else { return }
        let requestedFeed = feedKind
        let requestedReloadID = reloadID
        guard !requestedFeed.requiresAuthentication || session.phase == .signedIn else {
            posts = []
            nextCursor = nil
            isLoadingMore = false
            return
        }
        isLoadingMore = true
        paginationError = nil
        do {
            let page = try await session.fetchFeed(baseURL: apiBaseURL, kind: requestedFeed, cursor: cursor)
            guard requestedReloadID == reloadID, requestedFeed == feedKind else { return }
            posts = FeedPage.appending(page.data, to: posts)
            nextCursor = page.nextCursor
            errorMessage = nil
        } catch {
            guard requestedReloadID == reloadID, requestedFeed == feedKind else { return }
            paginationError = error.localizedDescription
        }
        if requestedReloadID == reloadID, requestedFeed == feedKind { isLoadingMore = false }
    }
}

private struct FeedPostRow: View {
    @Environment(SessionModel.self) private var session
    let post: FeedPost
    let onSignInRequired: () -> Void
    let onOpenProfile: (String) -> Void
    @State private var likeCount: Int
    @State private var repostCount: Int
    @State private var isLiked: Bool
    @State private var isReposted: Bool
    @State private var isSaved: Bool
    @State private var shareCount: Int
    @State private var isActionInProgress = false
    @State private var isSaveInProgress = false
    @State private var actionError: String?
    @State private var selectedGalleryIndex: Int?

    init(post: FeedPost, onSignInRequired: @escaping () -> Void, onOpenProfile: @escaping (String) -> Void) {
        self.post = post
        self.onSignInRequired = onSignInRequired
        self.onOpenProfile = onOpenProfile
        _likeCount = State(initialValue: post.likes)
        _repostCount = State(initialValue: post.reposts)
        _isLiked = State(initialValue: post.liked ?? false)
        _isReposted = State(initialValue: post.reposted ?? false)
        _isSaved = State(initialValue: post.bookmarked ?? false)
        _shareCount = State(initialValue: post.shares)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let authorID = post.author.id {
                Button { onOpenProfile(authorID) } label: { authorHeader }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Open @\(post.displayHandle)’s profile")
                    .accessibilityIdentifier("feed-author-profile-\(post.id)")
            } else {
                authorHeader
            }
            postBody

            HStack(spacing: 26) {
                Button {
                    Task { await toggleLike() }
                } label: {
                    Label(likeCount.formatted(), systemImage: isLiked ? "heart.fill" : "heart")
                        .font(.footnote)
                        .foregroundStyle(isLiked ? Color.red : Color.secondary)
                }
                .buttonStyle(.borderless)
                .disabled(isActionInProgress)
                .accessibilityLabel(isLiked ? "Unlike post, \(likeCount) likes" : "Like post, \(likeCount) likes")
                .accessibilityHint(isLiked ? "Removes your like" : "Adds your like")
                .accessibilityIdentifier("feed-like-\(post.id)")

                engagement("bubble", count: post.comments, label: "comments")

                Button {
                    Task { await toggleRepost() }
                } label: {
                    Label(repostCount.formatted(), systemImage: "arrow.2.squarepath")
                        .font(.footnote)
                        .foregroundStyle(isReposted ? Color.green : Color.secondary)
                }
                .buttonStyle(.borderless)
                .disabled(isActionInProgress)
                .accessibilityLabel(isReposted ? "Undo repost, \(repostCount) reposts" : "Repost post, \(repostCount) reposts")
                .accessibilityHint(isReposted ? "Removes your repost" : "Shares this post with your followers")
                .accessibilityIdentifier("feed-repost-\(post.id)")

                Button {
                    Task { await toggleSave() }
                } label: {
                    Label(isSaved ? "Saved" : "Save", systemImage: isSaved ? "bookmark.fill" : "bookmark")
                        .font(.footnote)
                        .foregroundStyle(isSaved ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.borderless)
                .disabled(isSaveInProgress)
                .accessibilityLabel(isSaved ? "Remove post from saved" : "Save post")
                .accessibilityHint(isSaved ? "Removes this post from your saved items" : "Adds this post to your saved items")
                .accessibilityAddTraits(isSaved ? .isSelected : [])
                .accessibilityIdentifier("feed-save-\(post.id)")

                PostShareButton(authorName: post.authorName, postID: post.id, count: shareCount) {
                    Task { @MainActor in
                        do {
                            try await session.recordPostShare(postID: post.id)
                            shareCount += 1
                        } catch {
                            // Sharing remains complete even if analytics recording is unavailable.
                        }
                    }
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .contain)
        }
        .padding(.vertical, 8)
        .fullScreenCover(isPresented: Binding(
            get: { selectedGalleryIndex != nil },
            set: { if !$0 { selectedGalleryIndex = nil } }
        )) {
            FeedImageGalleryViewer(
                images: galleryImages,
                initialIndex: selectedGalleryIndex ?? 0,
                context: "Image in post by @\(post.displayHandle)"
            )
        }
        .alert("Couldn’t update post", isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "Please try again.")
        }
        .onChange(of: post.likes) { _, value in likeCount = value }
        .onChange(of: post.liked) { _, value in isLiked = value ?? false }
        .onChange(of: post.reposts) { _, value in repostCount = value }
        .onChange(of: post.reposted) { _, value in isReposted = value ?? false }
        .onChange(of: post.bookmarked) { _, value in isSaved = value ?? false }
    }

    private var authorHeader: some View {
        HStack(spacing: 12) {
            Group {
                if let avatarURL = post.displayAvatarUrl {
                    AsyncImage(url: avatarURL) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { avatarFallback }
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
                    Text(post.displayName).font(.headline).lineLimit(1)
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
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }

    private var postBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            NavigationLink(value: AppRoute.post(post.id)) {
                Text(post.text)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Post: \(post.text)")
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens post details and replies")
            .accessibilityIdentifier("feed-post-body-\(post.id)")
            ForEach(post.media.filter { $0.previewUrl != nil }) { media in
                if let previewURL = media.previewUrl {
                    if let index = galleryImages.firstIndex(where: { $0.id == media.id }) {
                        Button {
                            selectedGalleryIndex = index
                        } label: {
                            mediaPreview(media, url: previewURL)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open image \(index + 1) of \(galleryImages.count)")
                        .accessibilityHint("Opens a full-screen image gallery. Swipe or use Previous image and Next image to browse.")
                        .accessibilityIdentifier("feed-open-image-\(post.id)-\(media.id)")
                    } else {
                        mediaPreview(media, url: previewURL)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("Video preview")
                    }
                }
            }
        }
    }

    private var galleryImages: [FeedImageGalleryItem] {
        FeedImageGalleryItem.readyImages(from: post.media)
    }

    private func mediaPreview(_ media: FeedPost.Media, url: URL) -> some View {
        AsyncImage(url: url) { phase in
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

    @MainActor
    private func toggleLike() async {
        guard session.phase == .signedIn else {
            onSignInRequired()
            return
        }
        guard !isActionInProgress else { return }
        let nextValue = !isLiked
        isActionInProgress = true
        defer { isActionInProgress = false }
        do {
            try await session.setPostLiked(postID: post.id, liked: nextValue)
            isLiked = nextValue
            likeCount = max(0, likeCount + (nextValue ? 1 : -1))
        } catch {
            actionError = error.localizedDescription
        }
    }

    @MainActor
    private func toggleRepost() async {
        guard session.phase == .signedIn else {
            onSignInRequired()
            return
        }
        guard !isActionInProgress else { return }
        let nextValue = !isReposted
        isActionInProgress = true
        defer { isActionInProgress = false }
        do {
            try await session.setPostReposted(postID: post.id, reposted: nextValue)
            isReposted = nextValue
            repostCount = max(0, repostCount + (nextValue ? 1 : -1))
        } catch {
            actionError = error.localizedDescription
        }
    }

    @MainActor
    private func toggleSave() async {
        guard session.phase == .signedIn else {
            onSignInRequired()
            return
        }
        guard !isSaveInProgress else { return }
        let nextValue = !isSaved
        isSaveInProgress = true
        defer { isSaveInProgress = false }
        do {
            try await session.setPostSaved(postID: post.id, saved: nextValue)
            isSaved = nextValue
        } catch {
            actionError = error.localizedDescription
        }
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
