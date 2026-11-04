import SwiftUI

struct WalletOverviewView: View {
    @Environment(SessionModel.self) private var session
    let onSignInRequired: () -> Void

    @State private var wallet: WalletSummary?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var escrowHolds: WalletEscrowHoldsPage?
    @State private var isLoadingEscrowHolds = false
    @State private var escrowHoldsError: String?
    @State private var escrowRequestGeneration = UUID()
    @State private var transactions: [WalletTransaction] = []
    @State private var isLoadingTransactions = false
    @State private var isLoadingMoreTransactions = false
    @State private var transactionsError: String?
    @State private var paginationError: String?
    @State private var transactionPage: WalletTransactionsPage?
    @State private var consumedTransactionCursors = Set<String>()
    @State private var transactionRequestGeneration = UUID()

    var body: some View {
        Group {
            if session.phase == .restoring {
                ProgressView("Restoring your secure session…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.phase != .signedIn {
                signedOutState
            } else {
                walletContent(wallet)
            }
        }
        .navigationTitle("Wallet")
        .task {
            await loadWallet()
            await loadTransactions(cursor: nil)
            await loadEscrowHolds()
        }
        .onChange(of: session.phase) { _, phase in
            if phase == .signedIn {
                Task { await loadWallet() }
                resetTransactionsAndReload()
                resetEscrowHoldsAndReload()
            } else {
                clearAccountData()
            }
        }
        .onChange(of: session.user?.id) { oldID, newID in
            guard oldID != newID else { return }
            if session.phase == .signedIn {
                clearAccountData()
                Task { await loadWallet() }
                resetTransactionsAndReload()
                resetEscrowHoldsAndReload()
            }
        }
    }

    private var signedOutState: some View {
        ContentUnavailableView {
            Label("Sign in to view your wallet", systemImage: "wallet.bifold")
        } description: {
            Text("Your balance and coin details are available only to you.")
        } actions: {
            Button("Go to account", systemImage: "person.crop.circle") {
                onSignInRequired()
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func walletContent(_ wallet: WalletSummary?) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if let wallet {
                    if let message = wallet.verification?.message?.trimmingCharacters(in: .whitespacesAndNewlines), !message.isEmpty {
                        Label {
                            Text(message).fixedSize(horizontal: false, vertical: true)
                        } icon: {
                            Image(systemName: "checkmark.shield")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(.tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("wallet-verification-message")
                    }

                    VStack(spacing: 0) {
                        ForEach(Array(WalletOverviewPresentation.lines(for: wallet).enumerated()), id: \.offset) { index, line in
                            walletLine(line, prominent: line.key == "available", isLast: index == WalletOverviewPresentation.lines(for: wallet).count - 1)
                        }
                    }
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .accessibilityIdentifier("wallet-balance-lines")

                    if let coins = wallet.coins {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("Coins", systemImage: "circle.hexagongrid.fill")
                                .font(.headline)
                            HStack(spacing: 12) {
                                coinCard(title: "Spendable", value: coins.spendable)
                                coinCard(title: "Earned", value: coins.earned)
                            }
                            Text("Coins are not cash.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding(16)
                        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .accessibilityIdentifier("wallet-coin-balances")
                    } else {
                        Label("Coin balances are unavailable in this wallet response.", systemImage: "circle.hexagongrid")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("wallet-coin-balances-unavailable")
                    }
                } else if isLoading {
                    ProgressView("Loading your wallet balance…")
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Wallet balance unavailable", systemImage: "exclamationmark.triangle")
                            .font(.subheadline.weight(.medium))
                        Text(errorMessage ?? "Your balance could not be loaded.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button("Retry balance", systemImage: "arrow.clockwise") {
                            Task { await loadWallet() }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isLoading)
                    }
                    .accessibilityIdentifier("wallet-balance-error")
                }

                escrowHoldsSection
                transactionsSection

                if wallet != nil {
                    Text("Each balance is kept separately. Escrow funds remain held until the order is released.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: 620, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(20)
        }
        .refreshable {
            await loadWallet()
            await loadTransactions(cursor: nil)
            await loadEscrowHolds()
        }
    }

    private var escrowHoldsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Held in escrow")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)

            if (isLoadingEscrowHolds || (escrowHolds == nil && escrowHoldsError == nil)) && escrowHolds == nil {
                ProgressView("Loading escrow holds…")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("wallet-escrow-loading")
            } else if let escrowHoldsError, escrowHolds == nil {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Escrow holds unavailable", systemImage: "wifi.exclamationmark")
                        .font(.subheadline.weight(.medium))
                    Text(escrowHoldsError)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Try Again", systemImage: "arrow.clockwise") {
                        Task { await loadEscrowHolds() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoadingEscrowHolds)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityIdentifier("wallet-escrow-error")
            } else if let escrowHolds, escrowHolds.data.isEmpty {
                ContentUnavailableView(
                    "No orders held in escrow",
                    systemImage: "lock.rectangle",
                    description: Text("Escrow details for your orders will appear here.")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .accessibilityIdentifier("wallet-escrow-empty")
            } else if let escrowHolds {
                VStack(spacing: 0) {
                    ForEach(Array(escrowHolds.data.enumerated()), id: \.element.id) { index, hold in
                        escrowHoldRow(hold)
                        if index < escrowHolds.data.count - 1 {
                            Rectangle().fill(.quaternary).frame(height: 1).padding(.leading, 16)
                        }
                    }
                }
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityIdentifier("wallet-escrow-list")

                if isLoadingEscrowHolds {
                    ProgressView("Refreshing escrow holds…")
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if let escrowHoldsError {
                    HStack(spacing: 12) {
                        Text(escrowHoldsError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        Button("Retry") {
                            Task { await loadEscrowHolds() }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isLoadingEscrowHolds)
                    }
                    .accessibilityIdentifier("wallet-escrow-refresh-error")
                }
            }
        }
        .accessibilityIdentifier("wallet-escrow-holds")
    }

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent transactions")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)

            if isLoadingTransactions && transactions.isEmpty {
                ProgressView("Loading recent transactions…")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("wallet-transactions-loading")
            } else if let transactionsError, transactions.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Transactions unavailable", systemImage: "wifi.exclamationmark")
                        .font(.subheadline.weight(.medium))
                    Text(transactionsError)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Try Again", systemImage: "arrow.clockwise") {
                        Task { await loadTransactions(cursor: nil) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoadingTransactions || isLoadingMoreTransactions)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityIdentifier("wallet-transactions-error")
            } else if transactions.isEmpty {
                ContentUnavailableView("No transactions yet", systemImage: "list.bullet.rectangle", description: Text("Wallet activity will appear here."))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .accessibilityIdentifier("wallet-transactions-empty")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                        transactionRow(transaction)
                        if index < transactions.count - 1 {
                            Rectangle().fill(.quaternary).frame(height: 1).padding(.leading, 16)
                        }
                    }
                }
                .background(.background.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityIdentifier("wallet-transactions-list")

                if isLoadingTransactions {
                    ProgressView("Refreshing transactions…")
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if let transactionsError {
                    HStack(alignment: .center, spacing: 12) {
                        Text(transactionsError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        Button("Retry") {
                            Task { await loadTransactions(cursor: nil) }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isLoadingTransactions || isLoadingMoreTransactions)
                    }
                    .accessibilityIdentifier("wallet-transactions-refresh-error")
                }

                if let paginationError {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(paginationError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button("Retry loading more", systemImage: "arrow.clockwise") {
                            Task { await loadTransactions(cursor: transactionsNextCursor) }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isLoadingMoreTransactions || isLoadingTransactions)
                    }
                    .accessibilityIdentifier("wallet-transactions-pagination-error")
                } else if isLoadingMoreTransactions {
                    ProgressView("Loading more transactions…")
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                        .accessibilityIdentifier("wallet-transactions-loading-more")
                } else if let nextCursor = transactionsNextCursor, !nextCursor.isEmpty {
                    Button("Load more transactions", systemImage: "arrow.down") {
                        Task { await loadTransactions(cursor: nextCursor) }
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    .disabled(isLoadingTransactions)
                    .accessibilityHint("Loads the next page of wallet activity")
                    .accessibilityIdentifier("wallet-transactions-load-more")
                } else {
                    Text("You’re viewing all available transactions")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .accessibilityIdentifier("wallet-transactions-end")
                }
            }
        }
        .accessibilityIdentifier("wallet-recent-transactions")
    }

    private var transactionsNextCursor: String? { transactionPage?.nextCursor }

    private func transactionRow(_ transaction: WalletTransaction) -> some View {
        let isCredit = transaction.kind == "credit"
        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: isCredit ? "arrow.down.left.circle.fill" : "arrow.up.right.circle.fill")
                .font(.title3)
                .foregroundStyle(isCredit ? .green : .secondary)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.description)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    Text(WalletTransactionPresentation.date(transaction.createdAt))
                    Text("·")
                    Text(WalletTransactionPresentation.status(transaction.status))
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            Text(WalletTransactionPresentation.amount(transaction))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(isCredit ? .green : .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(transaction.description), \(WalletTransactionPresentation.direction(transaction.kind)) \(WalletOverviewPresentation.amount(transaction.amount)), \(WalletTransactionPresentation.status(transaction.status)), \(WalletTransactionPresentation.date(transaction.createdAt))")
        .accessibilityIdentifier("wallet-transaction-\(transaction.id)")
    }

    private func walletLine(_ line: WalletLine, prominent: Bool, isLast: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(line.label)
                    .font(prominent ? .subheadline.weight(.semibold) : .subheadline)
                    .foregroundStyle(prominent ? Color.white.opacity(0.9) : .primary)
                Spacer(minLength: 8)
                Text(WalletOverviewPresentation.amount(line.amount))
                    .font(prominent ? .title2.weight(.bold) : .body.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(prominent ? .white : (line.key == "debts" && line.amount.amountMinor > 0 ? .red : .primary))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            if !line.description.isEmpty {
                Text(line.description)
                    .font(.footnote)
                    .foregroundStyle(prominent ? Color.white.opacity(0.82) : .secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            if prominent {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.accentColor.gradient)
            }
        }
        .overlay(alignment: .bottom) {
            if !prominent && !isLast {
                Rectangle().fill(.quaternary).frame(height: 1).padding(.leading, 16)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func coinCard(title: String, value: Int64) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(WalletOverviewPresentation.amount(WalletMoney(amountMinor: value, currency: "COIN")))
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
        .padding(12)
        .background(.background, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func escrowHoldRow(_ hold: WalletEscrowHold) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(hold.productName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Text(WalletOverviewPresentation.amount(hold.amount))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            Text(hold.orderReference)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Label(WalletEscrowHoldPresentation.stage(hold.stage), systemImage: "lock.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
            if let releaseDate = WalletEscrowHoldPresentation.releaseDate(hold.expectedReleaseAt) {
                Text("Expected release · \(releaseDate)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("wallet-escrow-hold-\(hold.orderId)")
    }

    @MainActor
    private func loadWallet() async {
        guard session.phase == .signedIn else { return }
        isLoading = true
        errorMessage = nil
        do {
            wallet = try await session.fetchWalletSummary()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    private func loadTransactions(cursor: String?) async {
        guard session.phase == .signedIn,
              !isLoadingTransactions,
              !isLoadingMoreTransactions else { return }
        let isFirstPage = cursor == nil
        let requestGeneration = transactionRequestGeneration
        let requestedUserID = session.user?.id
        if isFirstPage {
            isLoadingTransactions = true
            transactionsError = nil
        } else {
            isLoadingMoreTransactions = true
            paginationError = nil
        }
        defer {
            if requestGeneration == transactionRequestGeneration {
                isLoadingTransactions = false
                isLoadingMoreTransactions = false
            }
        }
        do {
            let page = try await session.fetchWalletTransactions(cursor: cursor)
            guard requestGeneration == transactionRequestGeneration,
                  session.phase == .signedIn,
                  session.user?.id == requestedUserID else { return }

            var consumed = isFirstPage ? Set<String>() : consumedTransactionCursors
            if let cursor, !cursor.isEmpty { consumed.insert(cursor) }
            let safePage = page.continuing(after: cursor, consumedCursors: consumed)
            if isFirstPage {
                transactions = WalletTransactionsPage.appending(page.data, to: [])
            } else {
                transactions = WalletTransactionsPage.appending(page.data, to: transactions)
            }
            transactionPage = safePage
            consumedTransactionCursors = consumed
            transactionsError = nil
            paginationError = nil
        } catch {
            guard requestGeneration == transactionRequestGeneration,
                  session.phase == .signedIn,
                  session.user?.id == requestedUserID else { return }
            if isFirstPage {
                transactionsError = error.localizedDescription
            } else {
                paginationError = error.localizedDescription
            }
        }
    }

    @MainActor
    private func loadEscrowHolds() async {
        guard session.phase == .signedIn, !isLoadingEscrowHolds else { return }
        let requestGeneration = escrowRequestGeneration
        let requestedUserID = session.user?.id
        isLoadingEscrowHolds = true
        escrowHoldsError = nil
        defer {
            if requestGeneration == escrowRequestGeneration {
                isLoadingEscrowHolds = false
            }
        }
        do {
            let page = try await session.fetchWalletEscrowHolds()
            guard requestGeneration == escrowRequestGeneration,
                  session.phase == .signedIn,
                  session.user?.id == requestedUserID else { return }
            escrowHolds = page
            escrowHoldsError = nil
        } catch {
            guard requestGeneration == escrowRequestGeneration,
                  session.phase == .signedIn,
                  session.user?.id == requestedUserID else { return }
            escrowHoldsError = error.localizedDescription
        }
    }

    @MainActor
    private func resetTransactionsAndReload() {
        transactionRequestGeneration = UUID()
        transactions = []
        transactionPage = nil
        consumedTransactionCursors = []
        transactionsError = nil
        paginationError = nil
        isLoadingTransactions = false
        isLoadingMoreTransactions = false
        Task { await loadTransactions(cursor: nil) }
    }

    @MainActor
    private func resetEscrowHoldsAndReload() {
        escrowRequestGeneration = UUID()
        escrowHolds = nil
        escrowHoldsError = nil
        isLoadingEscrowHolds = false
        Task { await loadEscrowHolds() }
    }

    @MainActor
    private func clearAccountData() {
        transactionRequestGeneration = UUID()
        escrowRequestGeneration = UUID()
        wallet = nil
        errorMessage = nil
        escrowHolds = nil
        escrowHoldsError = nil
        isLoadingEscrowHolds = false
        transactions = []
        transactionPage = nil
        consumedTransactionCursors = []
        transactionsError = nil
        paginationError = nil
        isLoading = false
        isLoadingTransactions = false
        isLoadingMoreTransactions = false
    }
}
