package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/sellercreditmaturity"
	"zudomart/modules/ledger/src/modules/journal/models"
	journalservices "zudomart/modules/ledger/src/modules/journal/services"
)

type SellerBalances struct {
	Ledger *journalservices.Ledger
	Outbox events.OutboxTable
	Now    func() time.Time
}

func NewSellerBalancesInSchema(ledgerSchema string) SellerBalances {
	return SellerBalances{Ledger: journalservices.NewLedgerInSchema(ledgerSchema), Outbox: events.OutboxTable{Schema: ledgerSchema, Source: "zudomart.ledger"}, Now: time.Now}
}

type LockedSellerCredit struct {
	SellerUserId    string
	Currency        string
	AmountMinor     int64
	SourceReference string
	AvailableAt     time.Time
}

func (balances SellerBalances) ScheduleLockedCreditInTransaction(ctx context.Context, transaction *sql.Tx, credit LockedSellerCredit) error {
	if credit.AmountMinor <= 0 {
		return nil
	}
	err := balances.Ledger.EntClientForExecutorInLedgerSchema(transaction).SellerCreditMaturity.Create().
		SetSellerUserID(credit.SellerUserId).SetCurrency(credit.Currency).SetSourceReference(credit.SourceReference).
		SetOriginalAmountMinor(credit.AmountMinor).SetRemainingAmountMinor(credit.AmountMinor).SetAvailableAt(credit.AvailableAt.UTC()).
		SetCreatedAt(balances.Now().UTC()).OnConflictColumns(sellercreditmaturity.FieldSourceReference).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}

func (balances SellerBalances) MatureDueCredits(ctx context.Context, database *sql.DB, batchSize int) (int, error) {
	matured := 0
	for matured < batchSize {
		found := false
		err := databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
			found = false
			client := balances.Ledger.EntClientForExecutorInLedgerSchema(transaction)
			due, err := client.SellerCreditMaturity.Query().
				Where(sellercreditmaturity.MaturedAtIsNil(), sellercreditmaturity.AvailableAtLTE(balances.Now().UTC())).
				Order(ent.Asc(sellercreditmaturity.FieldAvailableAt)).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
			if ent.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return err
			}
			found = true
			return balances.matureCreditInTransaction(ctx, transaction, client, due)
		})
		if err != nil || !found {
			return matured, err
		}
		matured++
	}
	return matured, nil
}

func (balances SellerBalances) matureCreditInTransaction(ctx context.Context, transaction *sql.Tx, client *ent.Client, due *ent.SellerCreditMaturity) error {
	now := balances.Now().UTC()
	if err := due.Update().SetMaturedAt(now).Exec(ctx); err != nil {
		return err
	}
	if due.RemainingAmountMinor == 0 {
		return nil
	}
	debt, err := balances.Ledger.ReadAccountBalance(ctx, transaction, models.SellerDebtAccount(due.SellerUserID, due.Currency))
	if err != nil {
		return err
	}
	repaid := min(debt, due.RemainingAmountMinor)
	terms, reserved, err := balances.reserveForMaturity(ctx, transaction, due.SellerUserID, due.SourceReference, due.RemainingAmountMinor-repaid)
	if err != nil {
		return err
	}
	if released := due.RemainingAmountMinor - reserved; released > 0 {
		lines := []models.JournalLineRequest{{Account: models.SellerPendingAccount(due.SellerUserID, due.Currency), Direction: models.Debit, AmountMinor: released}}
		if repaid > 0 {
			lines = append(lines, models.JournalLineRequest{Account: models.SellerDebtAccount(due.SellerUserID, due.Currency), Direction: models.Credit, AmountMinor: repaid})
		}
		if available := released - repaid; available > 0 {
			lines = append(lines, models.JournalLineRequest{Account: models.SellerAvailableAccount(due.SellerUserID, due.Currency), Direction: models.Credit, AmountMinor: available})
		}
		if _, err := balances.Ledger.PostBalancedJournalEntry(ctx, transaction, models.JournalEntryRequest{
			Reference: "seller-credit-matured:" + due.ID.String(), Kind: "sellerCredit.matured", Description: "Funds are now available",
			Metadata: map[string]any{"sourceReference": due.SourceReference, "debtRepaidMinor": repaid, "reservedMinor": reserved}, Lines: lines,
		}); err != nil {
			return err
		}
	}
	if reserved > 0 {
		if err := balances.ScheduleLockedCreditInTransaction(ctx, transaction, LockedSellerCredit{
			SellerUserId: due.SellerUserID, Currency: due.Currency, AmountMinor: reserved, SourceReference: sellerReserveSourcePrefix + due.ID.String(), AvailableAt: now.Add(terms.HoldFor),
		}); err != nil {
			return err
		}
	}
	return balances.Outbox.EnqueueInTransaction(ctx, transaction, "sellerCredit.matured", due.SellerUserID, now, map[string]any{
		"sellerUserId": due.SellerUserID, "sourceReference": due.SourceReference, "debtRepaidMinor": repaid, "reservedMinor": reserved,
		"amount": map[string]any{"amountMinor": due.RemainingAmountMinor, "currency": due.Currency},
	})
}

type SellerRefundDebit struct {
	SellerUserId             string
	Currency                 string
	AmountMinor              int64
	PreferredSourceReference string
	Reference                string
	Description              string
	CreditAccount            models.AccountRef
	Metadata                 map[string]any
}

type SellerFundsTaken struct {
	FromPendingMinor   int64 `json:"fromPendingMinor"`
	FromAvailableMinor int64 `json:"fromAvailableMinor"`
	IntoDebtMinor      int64 `json:"intoDebtMinor"`
}

func (balances SellerBalances) TakeSellerFundsForRefundInTransaction(ctx context.Context, transaction *sql.Tx, debit SellerRefundDebit) (SellerFundsTaken, error) {
	client := balances.Ledger.EntClientForExecutorInLedgerSchema(transaction)
	taken := SellerFundsTaken{}
	remaining := debit.AmountMinor
	credits, err := client.SellerCreditMaturity.Query().
		Where(sellercreditmaturity.SellerUserID(debit.SellerUserId), sellercreditmaturity.Currency(debit.Currency), sellercreditmaturity.MaturedAtIsNil(), sellercreditmaturity.RemainingAmountMinorGT(0)).
		Order(ent.Desc(sellercreditmaturity.FieldAvailableAt)).ForUpdate().All(ctx)
	if err != nil {
		return taken, err
	}
	orderPreferredFirst(credits, debit.PreferredSourceReference)
	for _, credit := range credits {
		if remaining == 0 {
			break
		}
		portion := min(remaining, credit.RemainingAmountMinor)
		if err := credit.Update().AddRemainingAmountMinor(-portion).Exec(ctx); err != nil {
			return taken, err
		}
		taken.FromPendingMinor += portion
		remaining -= portion
	}
	available, err := balances.Ledger.ReadAccountBalance(ctx, transaction, models.SellerAvailableAccount(debit.SellerUserId, debit.Currency))
	if err != nil {
		return taken, err
	}
	taken.FromAvailableMinor = min(remaining, max(available, 0))
	taken.IntoDebtMinor = remaining - taken.FromAvailableMinor
	var lines []models.JournalLineRequest
	for _, portion := range []struct {
		account models.AccountRef
		amount  int64
	}{
		{models.SellerPendingAccount(debit.SellerUserId, debit.Currency), taken.FromPendingMinor},
		{models.SellerAvailableAccount(debit.SellerUserId, debit.Currency), taken.FromAvailableMinor},
		{models.SellerDebtAccount(debit.SellerUserId, debit.Currency), taken.IntoDebtMinor},
	} {
		if portion.amount > 0 {
			lines = append(lines, models.JournalLineRequest{Account: portion.account, Direction: models.Debit, AmountMinor: portion.amount})
		}
	}
	lines = append(lines, models.JournalLineRequest{Account: debit.CreditAccount, Direction: models.Credit, AmountMinor: debit.AmountMinor})
	_, err = balances.Ledger.PostBalancedJournalEntry(ctx, transaction, models.JournalEntryRequest{
		Reference: debit.Reference, Kind: "sellerFunds.refunded", Description: debit.Description, Metadata: debit.Metadata, Lines: lines,
	})
	return taken, err
}

func orderPreferredFirst(credits []*ent.SellerCreditMaturity, preferredSourceReference string) {
	for index, credit := range credits {
		if credit.SourceReference == preferredSourceReference && index > 0 {
			credits[0], credits[index] = credits[index], credits[0]
			return
		}
	}
}
