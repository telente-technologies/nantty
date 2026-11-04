import SwiftUI

struct BuyerOrderDetailView: View {
    @Environment(SessionModel.self) private var session
    let orderID: String
    let onSignInRequired: () -> Void

    @State private var order: BuyerOrderDetail?
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
                    Label("Sign in to view this order", systemImage: "person.crop.circle")
                } description: {
                    Text("Only the account that placed an order can view its details.")
                } actions: {
                    Button("Sign in", action: onSignInRequired)
                }
            case .restoreUnavailable:
                unavailable(message: session.message ?? "Your session could not be restored.", retrySession: true)
            case .signedIn:
                detailContent
            }
        }
        .navigationTitle(order?.reference ?? "Order details")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { await loadOrder() }
        .onChange(of: session.phase) { _, phase in
            if phase == .signedIn { reloadID = UUID() }
        }
        .accessibilityIdentifier("buyer-order-detail")
    }

    @ViewBuilder
    private var detailContent: some View {
        if isLoading && order == nil {
            ProgressView("Loading order details…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let order {
            List {
                Section {
                    LabeledContent("Store", value: order.store.name)
                    LabeledContent("Status", value: order.status.capitalized)
                    LabeledContent("Fulfilment", value: order.fulfilmentStatus.replacingOccurrences(of: "_", with: " ").capitalized)
                    LabeledContent("Payment", value: "\(order.paymentStatus.capitalized) · \(order.paymentMode.capitalized)")
                    LabeledContent("Placed", value: BuyerOrderPresentation.date(order.createdAt))
                } header: {
                    Text(order.reference)
                }

                Section("Items") {
                    ForEach(order.items) { item in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(max(0, item.quantity)) × \(item.name)")
                                .font(.body)
                            if let variant = item.variant, !variant.isEmpty {
                                Text(variant)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Payment summary") {
                    moneyRow("Subtotal", order.subtotal)
                    if order.discount.amountMinor > 0 { moneyRow("Discount", order.discount, negative: true) }
                    if order.storeCredit.amountMinor > 0 { moneyRow("Store credit", order.storeCredit, negative: true) }
                    moneyRow("Shipping", order.shipping)
                    moneyRow("Total", order.total, prominent: true)
                }

                if let shipment = order.shipment {
                    Section("Shipment") {
                        if !shipment.courierName.isEmpty { LabeledContent("Courier", value: shipment.courierName) }
                        if !shipment.trackingNumber.isEmpty { LabeledContent("Tracking number", value: shipment.trackingNumber) }
                        LabeledContent("Shipped", value: BuyerOrderPresentation.date(shipment.shippedAt))
                        if let estimated = shipment.estimatedDeliveryAt {
                            LabeledContent("Estimated delivery", value: BuyerOrderPresentation.date(estimated))
                        }
                        Text("Delivery updates are shown here in Nantty.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let delivery = order.delivery {
                    Section("Delivery") {
                        LabeledContent("Status", value: delivery.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        if let riderName = delivery.riderName { LabeledContent("Rider", value: riderName) }
                        if let riderPhone = delivery.riderPhone { LabeledContent("Rider phone", value: riderPhone) }
                        if let estimated = delivery.estimatedDeliveryAt {
                            LabeledContent("Estimated delivery", value: BuyerOrderPresentation.date(estimated))
                        }
                        if delivery.attempts > 0 { LabeledContent("Delivery attempts", value: String(delivery.attempts)) }
                        if let note = delivery.lastAttemptNote { Text(note) }
                    }
                }

                if let releaseDate = order.escrowReleaseAt {
                    Section("Escrow") {
                        LabeledContent("Scheduled release", value: BuyerOrderPresentation.date(releaseDate))
                    }
                }

                if let issue = order.promotionIssue {
                    Section("Promotion") {
                        Text(issue.message)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await loadOrder() }
        } else {
            unavailable(message: errorMessage ?? "This order could not be loaded.", retrySession: false)
        }
    }

    private func unavailable(message: String, retrySession: Bool) -> some View {
        ContentUnavailableView {
            Label("Order unavailable", systemImage: "shippingbox")
        } description: {
            Text(message)
        } actions: {
            Button("Try again", systemImage: "arrow.clockwise") {
                if retrySession {
                    Task { await session.restoreSession() }
                } else {
                    reloadID = UUID()
                }
            }
        }
    }

    @ViewBuilder
    private func moneyRow(_ title: String, _ value: BuyerOrderMoney, negative: Bool = false, prominent: Bool = false) -> some View {
        let signed = WalletMoney(amountMinor: negative ? -value.amountMinor : value.amountMinor, currency: value.currency)
        LabeledContent(title, value: WalletOverviewPresentation.amount(signed))
            .fontWeight(prominent ? .semibold : .regular)
    }

    @MainActor
    private func loadOrder() async {
        guard session.phase == .signedIn else { return }
        let request = reloadID
        isLoading = true
        errorMessage = nil
        do {
            let loadedOrder = try await session.fetchBuyerOrder(orderID: orderID)
            guard request == reloadID else { return }
            order = loadedOrder
        } catch {
            guard request == reloadID else { return }
            errorMessage = error.localizedDescription
            if (error as? SessionAPIError)?.statusCode == 401 || (error as? SessionAPIError)?.statusCode == 403 {
                onSignInRequired()
            }
        }
        isLoading = false
    }
}
