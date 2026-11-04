import SwiftUI

struct PostThreadRequestScope {
    let postID: String
    let accountID: String?

    func matches(postID currentPostID: String, accountID currentAccountID: String?) -> Bool {
        postID == currentPostID && accountID == currentAccountID
    }
}

struct PostThreadView: View {
    static let platformIdentityLabel = "Nantty for iPhone"

    let postID: String
    let onRequestSignIn: () -> Void
    let onOpenPost: (String) -> Void

    @Environment(SessionModel.self) private var session
    @AppStorage("apiBaseURL") private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    @State private var post: ThreadPost?
    @State private var comments: [ThreadComment] = []
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var loadError: String?
    @State private var paginationError: String?
    @State private var nextCursor: String?
    @State private var consumedCursors: Set<String> = []
    @State private var loadedPostID: String?
    @State private var loadedAccountID: String?
    @State private var replyText = ""
    @State private var replyTarget: ThreadComment?
    @State private var commentProfiles: [ManagedCommentProfile] = []
    @State private var selectedCommentProfileID: String?
    @State private var commentProfileLoadFailed = false
    @State private var replyError: String?
    @State private var postActionError: String?
    @State private var isSending = false
    @State private var isLiking = false
    @State private var isReposting = false
    @State private var isSaving = false
    @State private var isLiked = false
    @State private var isReposted = false
    @State private var isSaved = false
    @State private var likeCount = 0
    @State private var repostCount = 0
    @State private var selectedGalleryIndex: Int?
    @State private var reloadID = UUID()

    var body: some View {
        Group {
            if !hasCurrentThreadContent && isLoading {
                ProgressView("Loading conversation…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if !hasCurrentThreadContent, let loadError {
                ContentUnavailableView {
                    Label("Conversation unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(loadError)
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") { reloadID = UUID() }
                }
            } else if !hasCurrentThreadContent {
                ProgressView("Loading conversation…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                conversation
            }
        }
        .navigationTitle("Conversation")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { await load() }
        .onChange(of: session.phase) { _, phase in
            if phase == .signedIn || phase == .signedOut {
                resetThreadForScopeChange()
                reloadID = UUID()
            }
        }
        .onChange(of: session.user?.id) { _, _ in
            if session.phase == .signedIn {
                resetThreadForScopeChange()
                reloadID = UUID()
            }
        }
        .onChange(of: postID) { _, _ in
            resetThreadForScopeChange()
            reloadID = UUID()
        }
    }

    private var hasCurrentThreadContent: Bool {
        guard post?.id == postID, loadedPostID == postID else { return false }
        switch session.phase {
        case .signedIn:
            return session.user?.id == loadedAccountID
        case .signedOut, .restoreUnavailable:
            return loadedAccountID == nil
        case .restoring:
            return false
        }
    }

    @MainActor
    private func resetThreadForScopeChange() {
        post = nil
        comments = []
        loadedPostID = nil
        loadedAccountID = nil
        isLoading = true
        isLoadingMore = false
        loadError = nil
        paginationError = nil
        nextCursor = nil
        consumedCursors = []
        replyText = ""
        replyTarget = nil
        commentProfiles = []
        selectedCommentProfileID = nil
        commentProfileLoadFailed = false
        replyError = nil
        postActionError = nil
        isSending = false
        isLiking = false
        isReposting = false
        isSaving = false
        isLiked = false
        isReposted = false
        isSaved = false
        likeCount = 0
        repostCount = 0
        selectedGalleryIndex = nil
    }

    private var conversation: some View {
        VStack(spacing: 0) {
            List {
                if let post {
                    Text(Self.platformIdentityLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityLabel(Self.platformIdentityLabel)
                        .accessibilityIdentifier("post-thread-platform-identity")
                        .listRowSeparator(.hidden)

                    Section {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 10) {
                                avatar(url: post.author.avatarUrl, name: post.author.name)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(post.author.name).font(.headline)
                                    Text("@\(post.author.username)").font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                            }
                            Text(PostTextLinks.attributedText(post.text))
                                .font(.body)
                                .tint(.accentColor)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityHint("Secure web links open in your browser")
                            ForEach(galleryImages.indices, id: \.self) { index in
                                let media = galleryImages[index]
                                Button {
                                    selectedGalleryIndex = index
                                } label: {
                                    AsyncImage(url: media.url) { phase in
                                        if let image = phase.image { image.resizable().scaledToFit() }
                                        else if phase.error != nil { Label("Image unavailable", systemImage: "photo").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 120) }
                                        else { ProgressView("Loading image…").frame(maxWidth: .infinity, minHeight: 120) }
                                    }
                                    .frame(maxWidth: .infinity)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(FeedImageGalleryNavigation.accessibilityLabel(
                                    context: "Image in post by @\(post.author.username)",
                                    index: index,
                                    count: galleryImages.count
                                ))
                                .accessibilityHint("Opens the image full screen")
                                .accessibilityIdentifier("post-thread-image-\(index + 1)")
                            }
                            postActions
                        }
                        .padding(.vertical, 8)
                    } header: {
                        Text("Post")
                    }
                }

                Section {
                    if comments.isEmpty {
                        ContentUnavailableView("No replies yet", systemImage: "text.bubble", description: Text("Be the first to join the conversation."))
                            .listRowSeparator(.hidden)
                    } else {
                        ForEach(comments) { comment in
                            ThreadCommentRow(comment: comment, depth: 0, onReply: beginReply)
                                .listRowSeparator(.visible)
                        }
                    }
                    paginationFooter
                    if isLoading { ProgressView().frame(maxWidth: .infinity).listRowSeparator(.hidden) }
                    if let loadError, post != nil {
                        VStack(alignment: .leading, spacing: 8) {
                            Label(loadError, systemImage: "exclamationmark.triangle")
                            Button("Retry") { reloadID = UUID() }
                        }
                        .font(.footnote)
                        .listRowSeparator(.hidden)
                    }
                } header: {
                    Text("Replies")
                }
            }
            .listStyle(.plain)
            .refreshable { await load() }
            .fullScreenCover(isPresented: Binding(
                get: { selectedGalleryIndex != nil },
                set: { if !$0 { selectedGalleryIndex = nil } }
            )) {
                FeedImageGalleryViewer(
                    images: galleryImages,
                    initialIndex: selectedGalleryIndex ?? 0,
                    context: "Image in post by @\(post?.author.username ?? "user")"
                )
            }

            replyComposer
        }
        .environment(\.openURL, OpenURLAction { url in
            if let internalPostID = PostTextLinks.internalPostID(from: url) {
                onOpenPost(internalPostID)
                return .handled
            }
            guard let safeURL = PostTextLinks.safeHTTPSURL(url.absoluteString) else { return .discarded }
            Task { await session.recordPostLinkClick(postID: postID) }
            return .systemAction(safeURL)
        })
    }

    private var galleryImages: [FeedImageGalleryItem] {
        FeedImageGalleryItem.readyImages(from: post?.media ?? [])
    }

    private var postActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 24) {
                Button(action: toggleLike) {
                    Label(likeCount.formatted(), systemImage: isLiked ? "heart.fill" : "heart")
                        .foregroundStyle(isLiked ? Color.pink : Color.primary.opacity(0.55))
                }
                .disabled(isLiking || isLoading)
                .accessibilityLabel(isLiked ? "Unlike post, \(likeCount) likes" : "Like post, \(likeCount) likes")
                .accessibilityIdentifier("post-like-action")

                Button(action: toggleRepost) {
                    Label(repostCount.formatted(), systemImage: "arrow.2.squarepath")
                        .foregroundStyle(isReposted ? Color.accentColor : Color.primary.opacity(0.55))
                }
                .disabled(isReposting || isLoading)
                .accessibilityLabel(isReposted ? "Undo repost, \(repostCount) reposts" : "Repost, \(repostCount) reposts")
                .accessibilityIdentifier("post-repost-action")

                Button(action: toggleSave) {
                    Label(isSaved ? "Saved" : "Save", systemImage: isSaved ? "bookmark.fill" : "bookmark")
                        .foregroundStyle(isSaved ? Color.accentColor : Color.primary.opacity(0.55))
                }
                .disabled(isSaving || isLoading)
                .accessibilityLabel(isSaved ? "Remove post from saved" : "Save post")
                .accessibilityHint(isSaved ? "Removes this post from your saved items" : "Adds this post to your saved items")
                .accessibilityAddTraits(isSaved ? .isSelected : [])
                .accessibilityIdentifier("post-save-action")

                if let post {
                    PostShareButton(authorName: post.author.name, postID: post.id, count: nil) {
                        Task { @MainActor in
                            try? await session.recordPostShare(postID: post.id)
                        }
                    }
                    .accessibilityIdentifier("post-detail-share-action")
                }
            }
            .buttonStyle(.plain)
            .font(.subheadline.weight(.medium))

            if isLiking || isReposting || isSaving { ProgressView().controlSize(.small) }
            if let postActionError {
                Text(postActionError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("post-action-error")
            }
        }
        .padding(.top, 4)
    }

    @ViewBuilder
    private var replyComposer: some View {
        if session.phase == .signedIn {
            VStack(alignment: .leading, spacing: 8) {
                if !commentProfiles.isEmpty {
                    commentIdentityPicker
                } else if commentProfileLoadFailed {
                    Text("Business identities aren’t available right now. You can still reply personally.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("comment-profile-load-status")
                }
                if let replyTarget {
                    HStack(spacing: 8) {
                        Label("Replying to @\(replyTarget.author.username)", systemImage: "arrowshape.turn.up.left")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        Button("Cancel") { cancelReplyTarget() }
                            .font(.footnote.weight(.semibold))
                            .accessibilityLabel("Cancel reply to @\(replyTarget.author.username)")
                    }
                }
                if let replyError { Text(replyError).font(.footnote).foregroundStyle(.red) }
                HStack(alignment: .bottom, spacing: 10) {
                    TextField(replyTarget.map { "Write a reply to @\($0.author.username)…" } ?? "Write a reply…", text: $replyText, axis: .vertical)
                        .lineLimit(1...4)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Reply text")
                    Button(action: sendReply) {
                        if isSending { ProgressView() }
                        else { Image(systemName: "arrow.up.circle.fill").font(.system(size: 30)) }
                    }
                    .disabled(isSending || replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || post == nil)
                    .accessibilityLabel("Send reply")
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.bar)
        } else {
            Button(action: onRequestSignIn) {
                Label(session.phase == .restoring ? "Restoring account…" : "Sign in to reply", systemImage: "person.crop.circle")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .disabled(session.phase == .restoring || session.phase == .restoreUnavailable)
            .background(.bar)
        }
    }

    @MainActor
    private func load() async {
        let requestedReloadID = reloadID
        isLoading = true
        isLoadingMore = false
        loadError = nil
        paginationError = nil
        nextCursor = nil
        consumedCursors = []
        do {
            let service = PostThreadService(baseURL: apiBaseURL)
            let fetchedPost = if session.phase == .signedIn {
                try await session.fetchPost(postID: postID)
            } else {
                try await service.fetchPost(id: postID)
            }
            guard requestedReloadID == reloadID else { return }
            post = fetchedPost
            loadedPostID = postID
            loadedAccountID = session.user?.id
            isLiked = fetchedPost.liked
            isReposted = fetchedPost.reposted
            isSaved = fetchedPost.bookmarked ?? false
            likeCount = fetchedPost.likes
            repostCount = fetchedPost.reposts
            let page = try await service.fetchThread(postID: postID)
            guard requestedReloadID == reloadID else { return }
            comments = page.data
            nextCursor = page.usableNextCursor
            if session.phase == .signedIn {
                do {
                    let fetchedProfiles = try await session.fetchCommentProfiles()
                    guard requestedReloadID == reloadID else { return }
                    commentProfiles = fetchedProfiles
                    if !commentProfiles.contains(where: { $0.id == selectedCommentProfileID }) {
                        selectedCommentProfileID = nil
                    }
                    commentProfileLoadFailed = false
                } catch {
                    commentProfiles = []
                    selectedCommentProfileID = nil
                    commentProfileLoadFailed = true
                }
            } else {
                commentProfiles = []
                selectedCommentProfileID = nil
            }
        } catch {
            guard requestedReloadID == reloadID else { return }
            loadError = error.localizedDescription
        }
        if requestedReloadID == reloadID { isLoading = false }
    }

    @ViewBuilder
    private var paginationFooter: some View {
        if let paginationError {
            VStack(spacing: 8) {
                Text(paginationError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("thread-pagination-error")
                Button("Retry loading more replies") { Task { await loadMore() } }
                    .accessibilityHint("Retries loading the next page of replies")
                    .accessibilityIdentifier("thread-pagination-retry")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .listRowSeparator(.hidden)
        } else if isLoadingMore {
            ProgressView("Loading more replies…")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .accessibilityIdentifier("thread-pagination-loading")
                .listRowSeparator(.hidden)
        } else if nextCursor != nil {
            Button("Load more replies") { Task { await loadMore() } }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .accessibilityHint("Loads the next page of replies")
                .accessibilityIdentifier("thread-load-more")
                .listRowSeparator(.hidden)
        } else if !comments.isEmpty {
            Label("You’ve reached the end of the conversation", systemImage: "checkmark.circle")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .accessibilityIdentifier("thread-pagination-end")
                .listRowSeparator(.hidden)
        }
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, !isLoadingMore, let cursor = nextCursor, !consumedCursors.contains(cursor) else { return }
        let requestedReloadID = reloadID
        consumedCursors.insert(cursor)
        isLoadingMore = true
        paginationError = nil
        do {
            let page = try await PostThreadService(baseURL: apiBaseURL).fetchThread(postID: postID, cursor: cursor)
            guard requestedReloadID == reloadID else { return }
            let safePage = page.continuing(after: cursor, consumedCursors: consumedCursors)
            comments = ThreadCommentPage.appending(safePage.data, to: comments)
            nextCursor = safePage.nextCursor
            loadError = nil
        } catch {
            guard requestedReloadID == reloadID else { return }
            consumedCursors.remove(cursor)
            paginationError = error.localizedDescription
        }
        if requestedReloadID == reloadID { isLoadingMore = false }
    }

    private func toggleLike() {
        guard let post else { return }
        guard session.phase == .signedIn else {
            onRequestSignIn()
            return
        }
        let nextValue = !isLiked
        let requestScope = PostThreadRequestScope(postID: post.id, accountID: session.user?.id)
        isLiking = true
        postActionError = nil
        Task { @MainActor in
            do {
                try await session.setPostLiked(postID: requestScope.postID, liked: nextValue)
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                isLiked = nextValue
                likeCount = max(0, likeCount + (nextValue ? 1 : -1))
            } catch {
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                postActionError = error.localizedDescription
            }
            guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
            isLiking = false
        }
    }

    private func toggleRepost() {
        guard let post else { return }
        guard session.phase == .signedIn else {
            onRequestSignIn()
            return
        }
        let nextValue = !isReposted
        let requestScope = PostThreadRequestScope(postID: post.id, accountID: session.user?.id)
        isReposting = true
        postActionError = nil
        Task { @MainActor in
            do {
                try await session.setPostReposted(postID: requestScope.postID, reposted: nextValue)
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                isReposted = nextValue
                repostCount = max(0, repostCount + (nextValue ? 1 : -1))
            } catch {
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                postActionError = error.localizedDescription
            }
            guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
            isReposting = false
        }
    }

    private func toggleSave() {
        guard let post else { return }
        guard session.phase == .signedIn else {
            onRequestSignIn()
            return
        }
        guard !isSaving else { return }
        let nextValue = !isSaved
        let requestScope = PostThreadRequestScope(postID: post.id, accountID: session.user?.id)
        isSaving = true
        postActionError = nil
        Task { @MainActor in
            do {
                try await session.setPostSaved(postID: requestScope.postID, saved: nextValue)
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                isSaved = nextValue
            } catch {
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                postActionError = error.localizedDescription
            }
            guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
            isSaving = false
        }
    }

    private func sendReply() {
        let text = replyText
        guard let post else { return }
        let requestScope = PostThreadRequestScope(postID: post.id, accountID: session.user?.id)
        let parentCommentID = replyTarget?.id
        let selectedProfileID = selectedCommentProfileID.flatMap { profileID in
            commentProfiles.contains(where: { $0.id == profileID && $0.isEligibleForCommenting }) ? profileID : nil
        }
        if selectedCommentProfileID != nil, selectedProfileID == nil {
            selectedCommentProfileID = nil
            replyError = "That profile is no longer available. Your reply will use your personal profile."
            return
        }
        isSending = true
        replyError = nil
        Task { @MainActor in
            do {
                let created = try await session.submitReply(postID: requestScope.postID, text: text, parentCommentID: parentCommentID, asProfileID: selectedProfileID)
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                replyText = ""
                replyTarget = nil
                if parentCommentID != nil {
                    await load()
                } else {
                    comments.insert(created, at: 0)
                }
            } catch {
                guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
                replyError = error.localizedDescription
            }
            guard requestScope.matches(postID: postID, accountID: session.user?.id), session.phase == .signedIn else { return }
            isSending = false
        }
    }

    private func beginReply(to comment: ThreadComment) {
        guard session.phase == .signedIn else {
            onRequestSignIn()
            return
        }
        replyTarget = comment
        replyError = nil
    }

    private func cancelReplyTarget() {
        replyTarget = nil
        replyError = nil
    }

    private var commentIdentityPicker: some View {
        Menu {
            Button {
                selectedCommentProfileID = nil
            } label: {
                if selectedCommentProfileID == nil { Label("Personal profile", systemImage: "checkmark") }
                else { Text("Personal profile") }
            }
            ForEach(commentProfiles) { profile in
                Button {
                    selectedCommentProfileID = profile.id
                } label: {
                    if selectedCommentProfileID == profile.id {
                        Label("\(profile.name) · \(profile.displayKind)", systemImage: "checkmark")
                    } else {
                        Text("\(profile.name) · \(profile.displayKind)")
                    }
                }
            }
        } label: {
            Label("Commenting as \(selectedCommentProfile?.name ?? "yourself")", systemImage: "person.crop.circle")
                .font(.subheadline.weight(.medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .accessibilityHint("Choose whether to reply as your personal profile or a business, brand, or store profile.")
        .accessibilityIdentifier("comment-identity-picker")
    }

    private var selectedCommentProfile: ManagedCommentProfile? {
        commentProfiles.first { $0.id == selectedCommentProfileID && $0.isEligibleForCommenting }
    }

    private func avatar(url: URL?, name: String) -> some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { avatarFallback(name) }
                }
            } else { avatarFallback(name) }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
        .accessibilityLabel("Profile photo for \(name)")
    }

    private func avatarFallback(_ name: String) -> some View {
        Circle().fill(Color(uiColor: .secondarySystemBackground)).overlay {
            Text(String(name.prefix(1)).uppercased()).foregroundStyle(.secondary)
        }
    }
}

private struct ThreadCommentRow: View {
    let comment: ThreadComment
    let depth: Int
    let onReply: (ThreadComment) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(comment.author.name).font(.subheadline.weight(.semibold))
                    Text("@\(comment.author.username)").font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Text(Self.dateFormatter.localizedString(from: ISO8601DateFormatter().date(from: comment.createdAt) ?? .now, dateStyle: .short, timeStyle: .short))
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            Text(PostTextLinks.attributedText(comment.text))
                .font(.body)
                .tint(.accentColor)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityHint("Secure web links open in your browser")
            ForEach(comment.media.filter { $0.previewURL != nil }) { media in
                if let url = media.previewURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFit()
                        } else if phase.error != nil {
                            Label(media.type == "video" ? "Video preview unavailable" : "Image unavailable", systemImage: media.type == "video" ? "play.rectangle" : "photo")
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, minHeight: 100)
                        } else {
                            ProgressView(media.type == "video" ? "Loading video preview…" : "Loading image…")
                                .frame(maxWidth: .infinity, minHeight: 100)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .accessibilityLabel(media.type == "video" ? "Video reply preview" : "Attached image")
                }
            }
            let readyVideoReplies = comment.videoReplies.filter { $0.previewURL != nil }
            if !readyVideoReplies.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        ForEach(readyVideoReplies) { videoReply in
                            if let url = videoReply.previewURL {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().scaledToFill()
                                    } else if phase.error != nil {
                                        Label("Video preview unavailable", systemImage: "play.rectangle")
                                            .foregroundStyle(.secondary)
                                    } else {
                                        ProgressView("Loading video preview…")
                                    }
                                }
                                .frame(width: 180, height: 112)
                                .clipped()
                                .overlay {
                                    Image(systemName: "play.fill")
                                        .font(.title2)
                                        .foregroundStyle(.white)
                                        .shadow(radius: 3)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .accessibilityLabel("Video reply preview")
                            }
                        }
                    }
                }
                .accessibilityLabel("Video replies")
            }
            Button {
                onReply(comment)
            } label: {
                Label("Reply", systemImage: "arrowshape.turn.up.left")
                    .font(.subheadline.weight(.medium))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.tint)
            .accessibilityLabel("Reply to @\(comment.author.username)")
            ForEach(comment.inlineReplies) { reply in
                ThreadCommentRow(comment: reply, depth: depth + 1, onReply: onReply)
                    .padding(.leading, 14)
                    .overlay(alignment: .leading) { Rectangle().fill(.quaternary).frame(width: 2) }
            }
        }
        .padding(.leading, min(CGFloat(depth) * 10, 60))
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
    }

    private var avatar: some View {
        Group {
            if let url = comment.author.avatarUrl {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { fallback }
                }
            } else { fallback }
        }
        .frame(width: 34, height: 34)
        .clipShape(Circle())
        .accessibilityLabel("Profile photo for \(comment.author.name)")
    }

    private var fallback: some View {
        Circle().fill(Color(uiColor: .secondarySystemBackground)).overlay {
            Text(String(comment.author.name.prefix(1)).uppercased()).font(.caption).foregroundStyle(.secondary)
        }
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()
}
