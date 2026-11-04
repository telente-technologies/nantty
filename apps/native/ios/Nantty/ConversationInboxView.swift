import SwiftUI

struct ConversationInboxView: View {
    @Environment(SessionModel.self) private var session
    let onSignInRequired: () -> Void

    @State private var conversations: [InboxConversation] = []
    @State private var nextCursor: String?
    @State private var consumedCursors = Set<String>()
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var paginationError: String?
    @State private var requestID = UUID()

    var body: some View {
        Group {
            if session.phase == .restoring {
                ProgressView("Restoring your secure session…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.phase != .signedIn {
                ContentUnavailableView {
                    Label("Sign in to view conversations", systemImage: "bubble.left.and.bubble.right")
                } description: {
                    Text("Your conversation list is private to your account.")
                } actions: {
                    Button("Sign in", systemImage: "person.crop.circle") {
                        onSignInRequired()
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("inbox-sign-in")
                }
            } else {
                inboxContent
            }
        }
        .navigationTitle("Inbox")
        .task(id: requestID) {
            guard session.phase == .signedIn else { return }
            await loadFirstPage()
        }
        .onChange(of: session.phase) { _, phase in
            if phase != .signedIn { clearInbox() }
            else { requestID = UUID() }
        }
        .onChange(of: session.user?.id) { oldID, newID in
            guard oldID != newID else { return }
            clearInbox()
            if newID != nil { requestID = UUID() }
        }
    }

    @ViewBuilder
    private var inboxContent: some View {
        if isLoading && conversations.isEmpty {
            ProgressView("Loading conversations…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("inbox-loading")
        } else if let errorMessage, conversations.isEmpty {
            ContentUnavailableView {
                Label("Inbox unavailable", systemImage: "wifi.exclamationmark")
            } description: {
                Text(errorMessage)
            } actions: {
                Button("Try Again", systemImage: "arrow.clockwise") { requestID = UUID() }
                    .buttonStyle(.borderedProminent)
            }
            .accessibilityIdentifier("inbox-error")
        } else if conversations.isEmpty {
            ContentUnavailableView("No conversations yet", systemImage: "bubble.left.and.bubble.right", description: Text("When you start or receive a conversation, it will appear here."))
                .accessibilityIdentifier("inbox-empty")
        } else {
            List {
                Section {
                    if let errorMessage {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Couldn’t refresh conversations", systemImage: "exclamationmark.triangle")
                                .font(.subheadline.weight(.medium))
                            Text(errorMessage).font(.footnote).foregroundStyle(.secondary)
                            Button("Try Again", systemImage: "arrow.clockwise") { requestID = UUID() }
                                .buttonStyle(.bordered)
                        }
                        .accessibilityIdentifier("inbox-refresh-error")
                    }

                    ForEach(conversations) { conversation in
                        ConversationInboxRow(conversation: conversation)
                    }

                    if let paginationError {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(paginationError).font(.footnote).foregroundStyle(.secondary)
                            Button("Retry loading more", systemImage: "arrow.clockwise") {
                                Task { await loadMore() }
                            }
                            .buttonStyle(.bordered)
                        }
                        .accessibilityIdentifier("inbox-pagination-error")
                    } else if nextCursor != nil {
                        Button {
                            Task { await loadMore() }
                        } label: {
                            HStack {
                                Spacer()
                                if isLoadingMore { ProgressView("Loading more…") }
                                else { Text("Load more conversations") }
                                Spacer()
                            }
                        }
                        .disabled(isLoadingMore)
                        .accessibilityIdentifier("inbox-load-more")
                    }
                } header: {
                    Text("Messages")
                } footer: {
                    Text("Message previews aren’t available in this inbox. Encrypted message content is not included in this list.")
                        .textCase(nil)
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await loadFirstPage() }
            .accessibilityIdentifier("conversation-inbox-list")
        }
    }

    @MainActor
    private func loadFirstPage() async {
        guard session.phase == .signedIn else { return }
        let activeRequest = requestID
        isLoading = true
        errorMessage = nil
        paginationError = nil
        defer { if activeRequest == requestID { isLoading = false } }

        do {
            let page = try await session.fetchConversationInbox()
            guard activeRequest == requestID, session.phase == .signedIn else { return }
            conversations = page.data
            nextCursor = page.safeNextCursor(consumed: consumedCursors)
            consumedCursors = []
            errorMessage = nil
        } catch {
            guard activeRequest == requestID else { return }
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func loadMore() async {
        guard !isLoadingMore, let cursor = nextCursor, !consumedCursors.contains(cursor) else { return }
        let activeRequest = requestID
        isLoadingMore = true
        paginationError = nil
        defer { if activeRequest == requestID { isLoadingMore = false } }

        do {
            let page = try await session.fetchConversationInbox(cursor: cursor)
            guard activeRequest == requestID, session.phase == .signedIn else { return }
            conversations = ConversationInboxPage.appending(page, to: conversations)
            consumedCursors.insert(cursor)
            nextCursor = page.safeNextCursor(consumed: consumedCursors)
        } catch {
            guard activeRequest == requestID else { return }
            paginationError = error.localizedDescription
        }
    }

    private func clearInbox() {
        conversations = []
        nextCursor = nil
        consumedCursors = []
        errorMessage = nil
        paginationError = nil
    }
}

private struct ConversationInboxRow: View {
    let conversation: InboxConversation

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let avatarURL = conversation.avatarURLForDisplay {
                    AsyncImage(url: avatarURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: symbol)
                            .font(.headline)
                            .foregroundStyle(.tint)
                    }
                } else {
                    Image(systemName: symbol)
                        .font(.headline)
                        .foregroundStyle(.tint)
                }
            }
            .frame(width: 44, height: 44)
            .background(.tint.opacity(0.12), in: Circle())
            .clipShape(Circle())
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 5) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(conversation.displayTitle)
                            .font(.body.weight(conversation.unread > 0 ? .semibold : .regular))
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                        Spacer(minLength: 4)
                        timestamp
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(conversation.displayTitle)
                            .font(.body.weight(conversation.unread > 0 ? .semibold : .regular))
                            .lineLimit(2)
                        timestamp
                    }
                }
                HStack(spacing: 8) {
                    Text(conversation.kindLabel)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if conversation.unread > 0 {
                        Text("\(conversation.unread) unread")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.tint, in: Capsule())
                            .accessibilityIdentifier("inbox-unread-\(conversation.id)")
                    }
                }
            }
        }
        .padding(.vertical, 5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityIdentifier("inbox-conversation-\(conversation.id)")
    }

    private var timestamp: some View {
        Text(ConversationInboxPresentation.timestamp(conversation.lastMessageAt))
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
    }

    private var symbol: String {
        switch conversation.kind {
        case .direct: "person.crop.circle"
        case .group: "person.3"
        case .channel: "megaphone"
        case .business: "storefront"
        }
    }

    private var accessibilityDescription: String {
        let unread = conversation.unread == 1 ? "1 unread message" : "\(conversation.unread) unread messages"
        return "\(conversation.displayTitle), \(conversation.kindLabel), \(ConversationInboxPresentation.timestamp(conversation.lastMessageAt)), \(unread)"
    }
}
