import SwiftUI

struct NotificationsView: View {
    @Environment(SessionModel.self) private var session
    let onSignInRequired: () -> Void
    let onOpenPost: (String) -> Void
    let onOpenProfile: (String) -> Void

    @State private var filter: NotificationFilter = .all
    @State private var notifications: [AppNotification] = []
    @State private var nextCursor: String?
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var isMarkingAll = false
    @State private var loadingError: String?
    @State private var paginationError: String?
    @State private var actionError: String?
    @State private var reloadID = UUID()
    @State private var busyIDs = Set<String>()

    private var hasUnread: Bool { notifications.contains { !$0.read } }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Notification filter", selection: $filter) {
                ForEach(NotificationFilter.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 10)
            .accessibilityIdentifier("notifications-filter")

            content
        }
        .task(id: reloadID) { await loadFirstPage() }
        .onChange(of: filter) { _, _ in resetAndReload() }
        .onChange(of: session.phase) { _, _ in resetAndReload() }
        .alert("Couldn’t update notifications", isPresented: Binding(
            get: { actionError != nil }, set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: { Text(actionError ?? "Please try again.") }
    }

    @ViewBuilder
    private var content: some View {
        switch session.phase {
        case .restoring:
            ProgressView("Checking your account…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .signedOut, .restoreUnavailable:
            ContentUnavailableView {
                Label("Sign in for notifications", systemImage: "bell.badge")
            } description: {
                Text("Your activity and mentions appear here when you’re signed in.")
            } actions: {
                Button("Open Account", systemImage: "person.crop.circle", action: onSignInRequired)
            }
        case .signedIn:
            signedInContent
        }
    }

    @ViewBuilder
    private var signedInContent: some View {
        if isLoading && notifications.isEmpty {
            ProgressView("Loading notifications…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadingError, notifications.isEmpty {
            ContentUnavailableView {
                Label("Notifications unavailable", systemImage: "wifi.exclamationmark")
            } description: {
                Text(loadingError)
            } actions: {
                Button("Try Again", systemImage: "arrow.clockwise") { resetAndReload() }
            }
        } else {
            List {
                if hasUnread {
                    Button {
                        Task { await markAllRead() }
                    } label: {
                        HStack {
                            Text(isMarkingAll ? "Marking all as read…" : "Mark all as read")
                            Spacer()
                            if isMarkingAll { ProgressView() }
                        }
                    }
                    .disabled(isMarkingAll)
                    .accessibilityIdentifier("notifications-mark-all-read")
                }

                ForEach(notifications) { notification in
                    NotificationRow(notification: notification, isBusy: busyIDs.contains(notification.id)) {
                        Task { await open(notification) }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }

                if notifications.isEmpty {
                    ContentUnavailableView(
                        filter == .mentions ? "No mentions yet" : "You’re all caught up",
                        systemImage: "bell",
                        description: Text(filter == .mentions ? "When someone tags you, it shows up here." : "New activity will appear here.")
                    )
                    .listRowSeparator(.hidden)
                } else {
                    paginationFooter
                }
            }
            .listStyle(.plain)
            .refreshable { await refreshFirstPage() }
            .overlay(alignment: .top) {
                if isLoading && !notifications.isEmpty {
                    ProgressView().padding(.top, 8)
                } else if let loadingError, !notifications.isEmpty {
                    HStack {
                        Text(loadingError).font(.footnote)
                        Button("Retry") { Task { await loadFirstPage() } }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity)
                    .background(.bar)
                }
            }
        }
    }

    @ViewBuilder
    private var paginationFooter: some View {
        if let paginationError {
            VStack(spacing: 8) {
                Text(paginationError).font(.footnote).foregroundStyle(.secondary)
                Button("Retry loading more") { Task { await loadMore() } }
            }
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .listRowSeparator(.hidden)
        } else if isLoadingMore {
            ProgressView("Loading more…").frame(maxWidth: .infinity).padding(.vertical, 14)
                .listRowSeparator(.hidden)
        } else if nextCursor != nil {
            Button("Load more notifications") { Task { await loadMore() } }
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .listRowSeparator(.hidden)
        } else {
            Label("You’ve reached the end", systemImage: "checkmark.circle")
                .font(.footnote).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .listRowSeparator(.hidden)
        }
    }

    @MainActor
    private func resetAndReload() {
        notifications = []
        nextCursor = nil
        loadingError = nil
        paginationError = nil
        isLoading = true
        isLoadingMore = false
        reloadID = UUID()
    }

    @MainActor
    private func refreshFirstPage() async {
        reloadID = UUID()
        await loadFirstPage()
    }

    @MainActor
    private func loadFirstPage() async {
        guard session.phase == .signedIn else {
            notifications = []
            nextCursor = nil
            isLoading = false
            return
        }
        let requestedFilter = filter
        let requestedReloadID = reloadID
        isLoading = true
        loadingError = nil
        paginationError = nil
        do {
            let page = try await session.fetchNotifications(filter: requestedFilter)
            guard requestedReloadID == reloadID, requestedFilter == filter, session.phase == .signedIn else { return }
            notifications = page.data
            nextCursor = page.nextCursor
        } catch {
            guard requestedReloadID == reloadID, requestedFilter == filter else { return }
            loadingError = error.localizedDescription
        }
        if requestedReloadID == reloadID { isLoading = false }
    }

    @MainActor
    private func loadMore() async {
        guard session.phase == .signedIn, !isLoading, !isLoadingMore, let cursor = nextCursor else { return }
        let requestedFilter = filter
        let requestedReloadID = reloadID
        isLoadingMore = true
        paginationError = nil
        do {
            let page = try await session.fetchNotifications(filter: requestedFilter, cursor: cursor)
            guard requestedReloadID == reloadID, requestedFilter == filter, session.phase == .signedIn else { return }
            notifications = NotificationsPage.appending(page.data, to: notifications)
            nextCursor = page.nextCursor
        } catch {
            guard requestedReloadID == reloadID, requestedFilter == filter else { return }
            paginationError = error.localizedDescription
        }
        if requestedReloadID == reloadID { isLoadingMore = false }
    }

    @MainActor
    private func open(_ notification: AppNotification) async {
        guard session.phase == .signedIn else { return }
        let requestedReloadID = reloadID
        if !notification.read {
            guard !busyIDs.contains(notification.id) else { return }
            busyIDs.insert(notification.id)
            defer { busyIDs.remove(notification.id) }
            do {
                try await session.markNotificationRead(id: notification.id)
                guard requestedReloadID == reloadID, session.phase == .signedIn else { return }
                notifications = notifications.map { item in
                    guard item.id == notification.id else { return item }
                    return item.markedRead()
                }
            } catch {
                guard requestedReloadID == reloadID, session.phase == .signedIn else { return }
                actionError = error.localizedDescription
                return
            }
        }
        guard requestedReloadID == reloadID, session.phase == .signedIn,
              let destination = NotificationRouting.destination(for: notification) else { return }
        switch destination {
        case .post(let postID): onOpenPost(postID)
        case .profile(let userID): onOpenProfile(userID)
        }
    }

    @MainActor
    private func markAllRead() async {
        guard hasUnread, !isMarkingAll, session.phase == .signedIn else { return }
        let requestedReloadID = reloadID
        isMarkingAll = true
        defer { isMarkingAll = false }
        do {
            try await session.markAllNotificationsRead()
            guard requestedReloadID == reloadID, session.phase == .signedIn else { return }
            notifications = notifications.map { $0.markedRead() }
        } catch {
            guard requestedReloadID == reloadID, session.phase == .signedIn else { return }
            actionError = error.localizedDescription
        }
    }
}

private struct NotificationRow: View {
    let notification: AppNotification
    let isBusy: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Group {
                    if let avatarURL = notification.actor?.avatarUrl {
                        AsyncImage(url: avatarURL) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            avatarFallback
                        }
                    } else {
                        avatarFallback
                    }
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    (Text(notification.title).fontWeight(.semibold) + Text(" \(notification.body)"))
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(Self.relativeDate(notification.createdAt))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                if !notification.read {
                    if isBusy {
                        ProgressView().controlSize(.small)
                    } else {
                        Circle().fill(Color.accentColor).frame(width: 9, height: 9)
                    }
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(notification.read ? Color.clear : Color.accentColor.opacity(0.06))
        .accessibilityLabel("\(notification.title) \(notification.body)\(notification.read ? "" : ", unread")")
        .accessibilityHint("Marks this notification as read and opens its post when available")
        .accessibilityIdentifier("notification-row-\(notification.id)")
    }

    private var avatarFallback: some View {
        Image(systemName: notification.actor == nil ? "bell.badge" : "person.crop.circle.fill")
            .resizable().scaledToFit().padding(9)
            .foregroundStyle(Color.accentColor)
            .background(Color.accentColor.opacity(0.12))
    }

    private static func relativeDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: value) else { return value }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
    }
}

private extension AppNotification {
    func markedRead() -> AppNotification {
        AppNotification(id: id, category: category, kind: kind, title: title, body: body,
                        createdAt: createdAt, read: true, actor: actor, url: url, data: data)
    }
}
