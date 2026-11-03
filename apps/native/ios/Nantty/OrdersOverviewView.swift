import SwiftUI

struct OrdersOverviewView: View {
    @Environment(SessionModel.self) private var session
    let selectedOrderID: String?
    let onSignInRequired: () -> Void

    @State private var response: OrdersWidgetAPIResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var reloadID = UUID()

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
                signedInContent
            }
        }
        .task(id: reloadID) { await loadOrders() }
        .onChange(of: session.phase) { _, phase in
            guard phase == .signedIn else { return }
            Task { await loadOrders() }
        }
        .refreshable { await loadOrders() }
        .accessibilityIdentifier("orders-overview")
    }

    @ViewBuilder
    private var signedInContent: some View {
        if isLoading && response == nil {
            ProgressView("Loading your orders…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage, response == nil {
            ContentUnavailableView {
                Label("Orders unavailable", systemImage: "wifi.exclamationmark")
            } description: {
                Text(errorMessage)
            } actions: {
                Button("Try again", systemImage: "arrow.clockwise") { reloadID = UUID() }
            }
        } else if let response, response.orders.isEmpty {
            ContentUnavailableView("No active orders", systemImage: "shippingbox", description: Text("Your active purchases will appear here."))
        } else if let response {
            List {
                ForEach(response.orders, id: \.id) { order in
                    OrderOverviewRow(order: order, isSelected: order.id == selectedOrderID)
                        .listRowBackground(order.id == selectedOrderID ? Color.accentColor.opacity(0.08) : Color.clear)
                }
            }
            .listStyle(.plain)
            .overlay(alignment: .top) {
                if let errorMessage {
                    Label("Showing saved results. \(errorMessage)", systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(.bar)
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                Text("\(response.activeCount) active orders")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
            }
        }
    }

    @MainActor
    private func loadOrders() async {
        guard session.phase == .signedIn else { return }
        isLoading = true
        errorMessage = nil
        do {
            response = try await session.fetchOrdersWidget()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct OrderOverviewRow: View {
    let order: OrdersWidgetAPIItem
    let isSelected: Bool

    private var eta: Date? {
        order.etaAt.flatMap { ISO8601DateFormatter().date(from: $0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(order.statusLabel)
                    .font(.headline)
                Spacer(minLength: 8)
                Text(order.reference)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Text(order.itemTitle)
                .font(.body)
                .lineLimit(2)
            HStack {
                Label(order.storeName, systemImage: "storefront")
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let eta {
                    Text(eta, style: .relative)
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption)
            if isSelected {
                Label("Opened from your home-screen widget", systemImage: "arrow.down.left.and.arrow.up.right")
                    .font(.caption2)
                    .foregroundStyle(.tint)
                if let trackingURL = order.safeTrackingURL {
                    Link(destination: trackingURL) {
                        Label("Track shipment", systemImage: "shippingbox")
                    }
                    .font(.caption.weight(.semibold))
                }
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .contain)
    }
}
