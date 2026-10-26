package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/withdrawal"
	"nantty/modules/wallet/src/modules/payouts/dtos"
	"nantty/platform/httpserver"
)

type WalletOverview struct {
	Container *container.Container
}

func (overview WalletOverview) ReadWalletSummary(ctx context.Context, userId, currency string) (dtos.WalletSummaryDto, error) {
	balances, err := ReadUserWalletBalances(ctx, overview.Container, overview.Container.Resources.Database, userId, currency)
	if err != nil {
		return dtos.WalletSummaryDto{}, err
	}
	money := func(amount int64) dtos.MoneyDto { return dtos.MoneyDto{AmountMinor: amount, Currency: currency} }
	summary := dtos.WalletSummaryDto{
		Available: money(balances.WithdrawableMinor()), Pending: money(balances.InEscrowMinor), Locked: money(balances.DepositHoldMinor),
		InEscrow: money(balances.InEscrowMinor), PayoutRequested: money(balances.ReservedPayoutMinor), NegativeBalance: money(balances.DebtsMinor()),
		NextAvailableAt: balances.NextAvailableAt, EarningsPayable: money(balances.CreatorEarningsMinor), Debts: money(balances.DebtsMinor()),
	}
	return summary, overview.completeWalletSummary(ctx, &summary, userId, currency, balances.WithdrawableMinor())
}

func (overview WalletOverview) ListWalletTransactions(ctx context.Context, userId, currency string, afterLineId *uuid.UUID, limit int) (httpserver.CursorPage[dtos.WalletTransactionDto], error) {
	database := overview.Container.Resources.Database
	lines, next, err := overview.Container.Ledger.ListStatementLinesNewestFirst(ctx, database, ledgerservices.StatementPageRequest{
		Accounts:    []ledgermodels.AccountRef{ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.WalletDepositHoldAccount(userId, currency)},
		AfterLineId: afterLineId, Limit: limit,
	})
	if err != nil {
		return httpserver.CursorPage[dtos.WalletTransactionDto]{}, err
	}
	withdrawalStatuses, err := overview.loadWithdrawalStatuses(ctx, lines)
	if err != nil {
		return httpserver.CursorPage[dtos.WalletTransactionDto]{}, err
	}
	transactions := make([]dtos.WalletTransactionDto, 0, len(lines))
	for _, line := range lines {
		if line.EntryKind == "sellerCredit.matured" || line.EntryKind == walletHoldReleasedKind {
			continue
		}
		kind, status := "debit", "completed"
		if line.IncreasesBalance {
			kind = "credit"
		}
		if strings.HasPrefix(line.EntryReference, "withdrawal-requested:") {
			status = withdrawalStatuses[strings.TrimPrefix(line.EntryReference, "withdrawal-requested:")]
		}
		if line.EntryKind == "sellerCredit.locked" || IsWalletHoldCreditKind(line.EntryKind) {
			status = "pending"
		}
		transactions = append(transactions, dtos.WalletTransactionDto{
			Id: line.LineId.String(), Kind: kind, Amount: dtos.MoneyDto{AmountMinor: line.AmountMinor, Currency: line.Currency},
			Description: line.Description, CreatedAt: line.CreatedAt, Status: status,
		})
	}
	nextCursor := ""
	if next != nil {
		nextCursor = next.String()
	}
	return httpserver.NewCursorPage(transactions, nextCursor), nil
}

func (overview WalletOverview) loadWithdrawalStatuses(ctx context.Context, lines []ledgerservices.StatementLine) (map[string]string, error) {
	identifiers := []uuid.UUID{}
	for _, line := range lines {
		if raw, found := strings.CutPrefix(line.EntryReference, "withdrawal-requested:"); found {
			if parsed, err := uuid.Parse(raw); err == nil {
				identifiers = append(identifiers, parsed)
			}
		}
	}
	statuses := map[string]string{}
	if len(identifiers) == 0 {
		return statuses, nil
	}
	rows, err := overview.Container.Client(overview.Container.Resources.Database).Withdrawal.Query().Where(withdrawal.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		statuses[row.ID.String()] = ConvertWithdrawal(row).Status
	}
	return statuses, nil
}

func (overview WalletOverview) ListWithdrawals(ctx context.Context, userId, status string, afterId *uuid.UUID, limit int) (httpserver.CursorPage[dtos.WithdrawalDto], error) {
	query := overview.Container.Client(overview.Container.Resources.Database).Withdrawal.Query()
	if userId != "" {
		query.Where(withdrawal.UserID(userId))
	}
	if status != "" {
		query.Where(withdrawal.StatusEQ(withdrawal.Status(status)))
	}
	if afterId != nil {
		query.Where(withdrawal.IDLT(*afterId))
	}
	rows, err := query.Order(ent.Desc(withdrawal.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.WithdrawalDto]{}, err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	converted := make([]dtos.WithdrawalDto, len(rows))
	for index, row := range rows {
		converted[index] = ConvertWithdrawal(row)
	}
	return httpserver.NewCursorPage(converted, nextCursor), nil
}
