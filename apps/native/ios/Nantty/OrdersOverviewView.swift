import SwiftUI

struct OrdersOverviewView: View {
    @Environment(SessionModel.self) private var session
    let selectedOrderID: String?
    let onOpenOrder: (String) -> Void
    let onSignInRequired: () -> Void

    @State private var filter: BuyerOrderFilter = .all
    @State private var orders: [BuyerOrderSummary] = []
    @State private var nextCursor: String?
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var paginationError: String?
    @State private var requestID = UUID()

    var body: some View {
        Group {
            switch session.phase {
            case .restoring:
                ProgressView("Restoring your session…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .signedOut:
                ContentUnavailableView {
                    Label("Sign in to view orders", systemImage: "person.crop.circle")
                } description: {
                    Text("Your orders are available only to the account that placed them.")
                } actions: {
                    Button("Sign in", action: onSignInRequired)
                }
            case .restoreUnavailable:
                ContentUnavailableView {
                    Label("Orders unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(session.message ?? "Your session could not be restored.")
                } actions: {
                    Button("Try again") { Task { await session.restoreSession() } }
                }
            case .signedIn:
                ordersContent
            }
        }
        .task(id: requestID) { await loadOrders(replacing: true) }
        .onChange(of: session.phase) { _, phase in
            guard phase == .signedIn else { return }
            requestID = UUID()
        }
        .onChange(of: filter) { _, _ in requestID = UUID() }
        .refreshable { await loadOrders(replacing: true) }
        .accessibilityIdentifier("buyer-orders")
    }

    @ViewBuilder
    private var ordersContent: some View {
        if isLoading && orders.isEmpty {
            ProgressView("Loading your orders…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage, orders.isEmpty {
            ContentUnavailableView {
                Label("Orders unavailable", systemImage: "wifi.exclamationmark")
            } description: {
                Text(errorMessage)
            } actions: {
                Button("Try again", systemImage: "arrow.clockwise") { requestID = UUID() }
            }
        } else if orders.isEmpty {
            ContentUnavailableView(
                filter == .all ? "No orders yet" : "No \(filter.label.lowercased()) orders",
                systemImage: "shippingbox",
                description: Text("Orders you place on Nantty will appear here.")
            )
        } else {
            List {
                ForEach(orders) { order in
                    Button { onOpenOrder(order.id) } label: {
                        BuyerOrderRow(order: order, isSelected: order.id == selectedOrderID)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("buyer-order-\(order.id)")
                }

                if let errorMessage {
                    Text("Showing loaded orders. \(errorMessage)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let nextCursor {
                    paginationFooter(cursor: nextCursor)
                }
            }
            .listStyle(.plain)
            .safeAreaInset(edge: .top, spacing: 0) {
                orderFilters
            }
        }
    }

    private var orderFilters: some View {
        HStack(spacing: 12) {
            Text("Filter")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
            Picker("Order status", selection: $filter) {
                ForEach(BuyerOrderFilter.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.menu)
            .accessibilityIdentifier("buyer-order-filter")
            Spacer(minLength: 0)
            Text("\(orders.count) loaded")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    @ViewBuilder
    private func paginationFooter(cursor: String) -> some View {
        if isLoadingMore {
            HStack {
                Spacer()
                ProgressView("Loading more orders…")
                Spacer()
            }
            .padding(.vertical, 12)
        } else if let paginationError {
            VStack(spacing: 8) {
                Text(paginationError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Try again") { Task { await loadMore(after: cursor) } }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        } else {
            Button("Load more orders") { Task { await loadMore(after: cursor) } }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .accessibilityIdentifier("load-more-buyer-orders")
        }
    }

    @MainActor
    private func loadOrders(replacing: Bool) async {
        guard session.phase == .signedIn else { return }
        let request = requestID
        isLoading = true
        errorMessage = nil
        paginationError = nil
        if replacing {
            orders = []
            nextCursor = nil
        }
        do {
            let page = try await session.fetchBuyerOrders(filter: filter)
            guard request == requestID else { return }
            orders = page.data
            nextCursor = safeNextCursor(page.nextCursor, requested: nil)
        } catch {
            guard request == requestID else { return }
            errorMessage = error.localizedDescription
            if (error as? SessionAPIError)?.statusCode == 401 || (error as? SessionAPIError)?.statusCode == 403 {
                onSignInRequired()
            }
        }
        isLoading = false
    }

    @MainActor
    private func loadMore(after cursor: String) async {
        guard !isLoadingMore else { return }
        isLoadingMore = true
        paginationError = nil
        defer { isLoadingMore = false }
        do {
            let page = try await session.fetchBuyerOrders(filter: filter, cursor: cursor)
            orders = BuyerOrdersPage.appending(page.data, to: orders)
            nextCursor = safeNextCursor(page.nextCursor, requested: cursor)
        } catch {
            paginationError = error.localizedDescription
            if (error as? SessionAPIError)?.statusCode == 401 || (error as? SessionAPIError)?.statusCode == 403 {
                onSignInRequired()
            }
        }
    }

    private func safeNextCursor(_ candidate: String?, requested: String?) -> String? {
        guard let candidate = candidate?.trimmingCharacters(in: .whitespacesAndNewlines),
              !candidate.isEmpty, candidate != requested else { return nil }
        return candidate
    }
}

private struct BuyerOrderRow: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let order: BuyerOrderSummary
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            metadata
            Text(order.store.name)
                .font(.headline)
                .lineLimit(2)
            if !order.itemSummary.isEmpty {
                Text(order.itemSummary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Text(WalletOverviewPresentation.amount(WalletMoney(
                amountMinor: order.total.amountMinor,
                currency: order.total.currency
            )))
            .font(.subheadline.weight(.semibold))
            if isSelected {
                Label("Opened from your home-screen widget", systemImage: "arrow.down.left.and.arrow.up.right")
                    .font(.caption2)
                    .foregroundStyle(.tint)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var metadata: some View {
        let stacked = horizontalSizeClass == .compact || dynamicTypeSize.isAccessibilitySize
        if stacked {
            VStack(alignment: .leading, spacing: 2) {
                status
                referenceAndDate
            }
        } else {
            ViewThatFits(in: .horizontal) {
                HStack {
                    status
                    Spacer(minLength: 8)
                    referenceAndDate
                }
                VStack(alignment: .leading, spacing: 2) {
                    status
                    referenceAndDate
                }
            }
        }
    }

    private var status: some View {
        Text(order.status.capitalized)
            .font(.headline)
            .foregroundStyle(.tint)
    }

    private var referenceAndDate: some View {
        Text("\(order.reference) · \(BuyerOrderPresentation.date(order.createdAt))")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(2)
    }
}

enum BuyerOrderPresentation {
    static func date(_ value: String, locale: Locale = .current, timeZone: TimeZone = .current) -> String {
        let date = ISO8601DateFormatter().date(from: value)
        guard let date else { return value }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}
