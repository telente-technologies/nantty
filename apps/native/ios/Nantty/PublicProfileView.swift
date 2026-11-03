import SwiftUI

struct PublicProfileView: View {
    let userID: String
    let onOpenPost: (String) -> Void
    let onRequestSignIn: () -> Void

    @Environment(SessionModel.self) private var session
    @AppStorage("apiBaseURL") private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    @State private var profile: PublicProfile?
    @State private var visibility: PublicProfileVisibility = .open
    @State private var followState = "none"
    @State private var isUpdatingFollow = false
    @State private var isConfirmingUnfollow = false
    @State private var followError: String?
    @State private var posts: [PublicProfilePost] = []
    @State private var nextCursor: String?
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var loadError: String?
    @State private var pageError: String?
    @State private var reloadID = UUID()

    var body: some View {
        Group {
            if isLoading && profile == nil {
                ProgressView("Loading profile…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let loadError, profile == nil {
                ContentUnavailableView {
                    Label("Profile unavailable", systemImage: "person.crop.circle.badge.exclamationmark")
                } description: {
                    Text(loadError)
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") { reloadID = UUID() }
                    if loadError == PublicProfileAPIError.signInRequired.localizedDescription {
                        Button("Open Account", systemImage: "person.crop.circle", action: onRequestSignIn)
                    }
                }
            } else if let profile {
                profileContent(profile)
            } else {
                ContentUnavailableView("Profile unavailable", systemImage: "person.crop.circle.badge.exclamationmark")
            }
        }
        .navigationTitle(profile.map { "@\($0.username)" } ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { await loadProfile() }
        .confirmationDialog(
            followState == "requested" ? "Cancel follow request?" : "Unfollow @\(profile?.username ?? "")?",
            isPresented: $isConfirmingUnfollow,
            titleVisibility: .visible
        ) {
            Button(followState == "requested" ? "Cancel request" : "Unfollow", role: .destructive) {
                Task { await updateFollow(shouldFollow: false) }
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text(followState == "requested" ? "They will no longer see your request." : "Their posts will no longer appear in your Following feed.")
        }
        .onChange(of: session.phase) { _, _ in
            posts = []
            profile = nil
            nextCursor = nil
            reloadID = UUID()
        }
        .accessibilityIdentifier("public-profile-view")
    }

    private func profileContent(_ profile: PublicProfile) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                profileHeader(profile)
                    .padding(.bottom, 18)

                switch visibility {
                case .privateProfile:
                    notice(
                        title: "This account is private",
                        message: "Public posts appear here after your follow request is accepted.",
                        symbol: "lock"
                    )
                case .blocked:
                    notice(title: "Profile posts are hidden", message: "Posts aren’t available while this account is blocked.", symbol: "hand.raised")
                case .suspended:
                    notice(title: "This account is suspended", message: "Profile posts aren’t available right now.", symbol: "person.crop.circle.badge.xmark")
                case .open:
                    publicPosts
                }
            }
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.bottom, 28)
        }
        .refreshable { await loadProfile() }
    }

    private func profileHeader(_ profile: PublicProfile) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            banner(profile.bannerUrl)
                .frame(height: 150)
                .clipped()
                .accessibilityLabel("Profile banner")

            HStack(alignment: .bottom, spacing: 14) {
                avatar(profile.avatarUrl, name: profile.name, size: 78)
                    .overlay(Circle().stroke(.background, lineWidth: 4))
                    .offset(y: -8)
                    .padding(.bottom, -8)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)

            if session.phase == .signedIn, session.user?.id != profile.id, profile.account?.status != "suspended", followState != "blocked" {
                Button {
                    if followState == "accepted" || followState == "requested" { isConfirmingUnfollow = true }
                    else { Task { await updateFollow(shouldFollow: true) } }
                } label: {
                    HStack {
                        if isUpdatingFollow { ProgressView().tint(.white) }
                        Text(followButtonTitle)
                    }
                    .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isUpdatingFollow)
                .padding(.horizontal, 18)
                .accessibilityIdentifier("profile-follow-toggle")
            }
            if let followError {
                Text(followError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 18)
                    .accessibilityIdentifier("profile-follow-error")
            }

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Text(profile.name).font(.title2.weight(.bold)).lineLimit(2)
                    if let badgeColor = visibleBadgeColor(profile) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(badgeColor)
                            .accessibilityLabel("Verified account")
                    }
                }
                Text("@\(profile.username)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !profile.bio.isEmpty {
                    Text(profile.bio)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 18)

            HStack(spacing: 18) {
                statistic(profile.followers, label: "Followers")
                statistic(profile.following, label: "Following")
                statistic(profile.posts, label: "Posts")
            }
            .padding(.horizontal, 18)
            .accessibilityElement(children: .combine)

            Divider().padding(.top, 4)
        }
        .background(.background)
    }

    private var publicPosts: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Posts")
                .font(.headline)
                .padding(.horizontal, 18)
                .padding(.vertical, 14)

            if posts.isEmpty && !isLoading {
                ContentUnavailableView("No public posts yet", systemImage: "text.bubble", description: Text("When this account shares public posts, they’ll appear here."))
                    .padding(.vertical, 20)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(posts) { post in
                        Button { onOpenPost(post.id) } label: {
                            ProfilePostRow(post: post)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("profile-post-\(post.id)")
                        Divider().padding(.leading, 18)
                    }
                }
            }

            if let pageError {
                VStack(alignment: .leading, spacing: 8) {
                    Label(pageError, systemImage: "exclamationmark.triangle")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button("Retry loading posts") { Task { await loadMore() } }
                }
                .padding(18)
            } else if isLoadingMore {
                ProgressView("Loading posts…")
                    .frame(maxWidth: .infinity)
                    .padding(18)
            } else if nextCursor != nil {
                Button("Load more posts", systemImage: "arrow.down") { Task { await loadMore() } }
                    .frame(maxWidth: .infinity)
                    .padding(18)
            }

            if let loadError, profile != nil {
                Label(loadError, systemImage: "exclamationmark.triangle")
                    .font(.footnote).foregroundStyle(.secondary)
                    .padding(18)
                Button("Retry", systemImage: "arrow.clockwise") { reloadID = UUID() }
                    .padding(.horizontal, 18)
            }
        }
    }

    private func notice(title: String, message: String, symbol: String) -> some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
    }

    private func banner(_ url: URL?) -> some View {
        Group {
            if let safeURL = safeImageURL(url) {
                AsyncImage(url: safeURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Rectangle().fill(Color(uiColor: .secondarySystemBackground)) }
                }
            } else {
                Rectangle().fill(Color(uiColor: .secondarySystemBackground))
                    .overlay(alignment: .bottomLeading) {
                        Image(systemName: "person.crop.rectangle")
                            .font(.title2)
                            .foregroundStyle(.tertiary)
                            .padding(16)
                    }
            }
        }
    }

    private func avatar(_ url: URL?, name: String, size: CGFloat) -> some View {
        Group {
            if let safeURL = safeImageURL(url) {
                AsyncImage(url: safeURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { avatarFallback(name) }
                }
            } else {
                avatarFallback(name)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityLabel("Profile photo for \(name)")
    }

    private func avatarFallback(_ name: String) -> some View {
        Circle()
            .fill(Color(uiColor: .secondarySystemBackground))
            .overlay {
                Text(String(name.prefix(1)).uppercased())
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
    }

    private func statistic(_ value: Int, label: String) -> some View {
        HStack(spacing: 4) {
            Text(value.formatted()).fontWeight(.semibold)
            Text(label).foregroundStyle(.secondary)
        }
        .font(.footnote)
    }

    private func visibleBadgeColor(_ profile: PublicProfile) -> Color? {
        guard let verification = profile.verification else { return profile.verified ? .accentColor : nil }
        guard verification.badgeVisible == true,
              verification.status == "active",
              verification.tier != "ESSENTIAL" else {
            return nil
        }
        return switch verification.color {
        case "gold": Color(red: 183.0 / 255.0, green: 121.0 / 255.0, blue: 31.0 / 255.0)
        case "black": Color.primary
        case "blue": .accentColor
        default: nil
        }
    }

    private func safeImageURL(_ url: URL?) -> URL? {
        guard let url,
              let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(),
              !host.isEmpty,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return url
    }

    @MainActor
    private func loadProfile() async {
        guard session.phase != .restoring else { return }
        let requestID = reloadID
        let requestPhase = session.phase
        isLoading = true
        loadError = nil
        pageError = nil
        do {
            let result = try await session.fetchPublicProfile(userID: userID, baseURL: apiBaseURL)
            guard requestID == reloadID, session.phase == requestPhase else { return }
            profile = result.profile
            visibility = result.visibility
            followState = result.followState
            posts = result.page?.data ?? []
            nextCursor = result.page?.nextCursor
        } catch {
            guard requestID == reloadID else { return }
            loadError = error.localizedDescription
        }
        if requestID == reloadID { isLoading = false }
    }

    private var followButtonTitle: String {
        switch followState {
        case "accepted": "Following"
        case "requested": "Requested"
        default: "Follow"
        }
    }

    @MainActor
    private func updateFollow(shouldFollow: Bool) async {
        guard !isUpdatingFollow, let profile, session.phase == .signedIn, session.user?.id != profile.id else { return }
        isUpdatingFollow = true
        followError = nil
        let previous = followState
        do {
            let result = try await session.setPublicFollowState(userID: profile.id, shouldFollow: shouldFollow, baseURL: apiBaseURL)
            followState = result.state
            reloadID = UUID()
        } catch {
            followState = previous
            followError = error.localizedDescription
        }
        isUpdatingFollow = false
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, !isLoadingMore, visibility == .open, let cursor = nextCursor else { return }
        let requestID = reloadID
        let requestPhase = session.phase
        isLoadingMore = true
        pageError = nil
        do {
            let page = try await session.fetchMorePublicPosts(userID: userID, cursor: cursor, baseURL: apiBaseURL)
            guard requestID == reloadID, session.phase == requestPhase else { return }
            posts = PublicProfilePostsPage.appending(page.data, to: posts)
            nextCursor = page.nextCursor
        } catch {
            guard requestID == reloadID else { return }
            pageError = error.localizedDescription
        }
        if requestID == reloadID { isLoadingMore = false }
    }
}

private struct ProfilePostRow: View {
    let post: PublicProfilePost

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(post.text)
                .font(.body)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(post.media) { media in
                if let url = media.previewURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFit() }
                        else if phase.error != nil { Label("Media unavailable", systemImage: "photo").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 100) }
                        else { ProgressView("Loading media…").frame(maxWidth: .infinity, minHeight: 100) }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .accessibilityLabel(media.type == "video" ? "Video preview" : "Attached image")
                }
            }

            HStack(spacing: 18) {
                Label(post.likes.formatted(), systemImage: "heart")
                Label(post.comments.formatted(), systemImage: "bubble")
                Label(post.reposts.formatted(), systemImage: "arrow.2.squarepath")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .accessibilityElement(children: .combine)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}
