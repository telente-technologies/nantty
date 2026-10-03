package services

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/adbalancetopup"
	"zudomart/modules/wallet/src/generated/ent/adspenddebit"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
)

func AdSpendDebitSplit(requestedMinor, balanceMinor int64) (int64, int64) {
	debited := min(max(requestedMinor, 0), max(balanceMinor, 0))
	return debited, max(requestedMinor, 0) - debited
}

func (balances AdBalances) ApplySpendBatch(ctx context.Context, batch dtos.SpendBatchRequestDto) (dtos.SpendBatchResultDto, error) {
	var result dtos.SpendBatchResultDto
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := balances.Container.Client(transaction)
		if existing, err := client.AdSpendDebit.Query().Where(adspenddebit.IdempotencyKey(batch.IdempotencyKey)).Only(ctx); err == nil {
			result = dtos.SpendBatchResultDto{DebitedMinor: existing.DebitedMinor, ShortfallMinor: existing.ShortfallMinor, Replayed: true}
			return nil
		} else if !ent.IsNotFound(err) {
			return err
		}
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "ad-balance:"+batch.AccountId); err != nil {
			return err
		}
		prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(batch.AccountId, batch.Currency)
		balance, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
		if err != nil {
			return err
		}
		debited, shortfall := AdSpendDebitSplit(batch.DebitMinor, balance)
		if err := client.AdSpendDebit.Create().SetBatchID(batch.BatchId).SetIdempotencyKey(batch.IdempotencyKey).SetAdAccountID(batch.AccountId).SetCurrency(batch.Currency).
			SetRequestedMinor(batch.DebitMinor).SetDebitedMinor(debited).SetShortfallMinor(shortfall).SetImpressionCount(batch.ImpressionCount).SetCreatedAt(balances.Container.Now()).Exec(ctx); err != nil {
			return err
		}
		result = dtos.SpendBatchResultDto{DebitedMinor: debited, ShortfallMinor: shortfall}
		now := balances.Container.Now().UTC()
		if debited > 0 {
			if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
				Reference: "ad-spend-" + batch.IdempotencyKey, Kind: "adBalance.spent", ExternalReference: batch.BatchId, Description: "Ad spend recognised as revenue",
				Lines: []ledgermodels.JournalLineRequest{
					{Account: prepaid, Direction: ledgermodels.Debit, AmountMinor: debited},
					{Account: ledgermodels.PlatformAdRevenueAccount(batch.Currency), Direction: ledgermodels.Credit, AmountMinor: debited},
				},
			}); err != nil {
				return err
			}
		}
		eventType := "adBalance.debited"
		if shortfall > 0 || balance-debited == 0 {
			eventType = "adBalance.exhausted"
		}
		return balances.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, batch.AccountId, now, map[string]any{
			"adAccountId": batch.AccountId, "batchId": batch.BatchId, "debitedMinor": debited, "shortfallMinor": shortfall, "currency": batch.Currency, "balanceAfterMinor": balance - debited,
		})
	})
	return result, err
}

func (balances AdBalances) RefundUnusedBalance(ctx context.Context, userId, adAccountId, currency string) (int64, error) {
	if !balances.Container.Settings.AdPrepaidRefundsEnabled {
		return 0, ErrRefundsDisabled
	}
	var refunded int64
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "ad-balance:"+adAccountId); err != nil {
			return err
		}
		prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, currency)
		remaining, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
		if err != nil {
			return err
		}
		topUps, err := balances.Container.Client(transaction).AdBalanceTopUp.Query().Where(adbalancetopup.AdAccountID(adAccountId), adbalancetopup.FundedByUserID(userId),
			adbalancetopup.StatusEQ(adbalancetopup.StatusSucceeded), adbalancetopup.Currency(currency)).Order(ent.Desc(adbalancetopup.FieldCreatedAt)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		if len(topUps) == 0 {
			return ErrAdAccountNotFunded
		}
		for _, topUp := range topUps {
			portion := min(remaining, topUp.AmountMinor-topUp.RefundedMinor)
			if portion <= 0 {
				continue
			}
			reference := "ad-refund-" + topUp.ID.String() + "-" + itoa(topUp.RefundedMinor)
			if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
				Reference: reference, Kind: "adBalance.refunded", Description: "Unused ad balance returned",
				Lines: []ledgermodels.JournalLineRequest{
					{Account: prepaid, Direction: ledgermodels.Debit, AmountMinor: portion},
					{Account: ledgermodels.RefundsPayableAccount(balances.Container.Payments.Container.Settings.DefaultProvider, currency), Direction: ledgermodels.Credit, AmountMinor: portion},
				},
			}); err != nil {
				return err
			}
			if _, err := balances.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
				PaymentIntentId: topUp.PaymentIntentID, AmountMinor: portion, Currency: currency, Reference: reference, Reason: "unused ad balance",
			}); err != nil {
				return err
			}
			if err := topUp.Update().AddRefundedMinor(portion).Exec(ctx); err != nil {
				return err
			}
			remaining -= portion
			refunded += portion
		}
		if refunded == 0 {
			return errors.New("nothing left to refund")
		}
		return nil
	})
	return refunded, err
}

func itoa(value int64) string {
	return strconv.FormatInt(value, 10)
}
