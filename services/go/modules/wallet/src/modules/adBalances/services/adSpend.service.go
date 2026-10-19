package services

import (
	"context"
	"database/sql"
	"strconv"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/generated/ent"
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
		if err := balances.postCreditSpendInTransaction(ctx, transaction, batch); err != nil {
			return err
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
	var refunded int64
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := lockAdvisory(ctx, transaction, "ad-balance:"+adAccountId); err != nil {
			return err
		}
		sources, err := balances.lockFundingSourcesNewestFirst(ctx, transaction, userId, adAccountId, currency)
		if err != nil {
			return err
		}
		if len(sources) == 0 {
			return ErrAdAccountNotFunded
		}
		prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, currency)
		remaining, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
		if err != nil {
			return err
		}
		cardRefunds := balances.Container.Settings.AdPrepaidRefundsEnabled
		blockedByPolicy := false
		for _, source := range sources {
			portion := min(remaining, source.unrefundedMinor())
			if portion <= 0 {
				continue
			}
			remaining -= portion
			if source.earnings != nil {
				if err := balances.returnEarningsCredit(ctx, transaction, source.earnings, portion, "ad-earnings-refund:"+source.earnings.ID.String()+"-"+itoa(source.earnings.RefundedMinor)); err != nil {
					return err
				}
			} else if !cardRefunds {
				blockedByPolicy = true
				continue
			} else if err := balances.refundCardTopUp(ctx, transaction, source.topUp, portion); err != nil {
				return err
			}
			refunded += portion
		}
		switch {
		case refunded > 0:
			return nil
		case blockedByPolicy:
			return ErrRefundsDisabled
		}
		return ErrNothingToRefund
	})
	return refunded, err
}

func (balances AdBalances) refundCardTopUp(ctx context.Context, transaction *sql.Tx, topUp *ent.AdBalanceTopUp, portion int64) error {
	reference := "ad-refund-" + topUp.ID.String() + "-" + itoa(topUp.RefundedMinor)
	if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "adBalance.refunded", Description: "Unused ad balance returned",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.AdvertiserPrepaidBalanceAccount(topUp.AdAccountID, topUp.Currency), Direction: ledgermodels.Debit, AmountMinor: portion},
			{Account: ledgermodels.RefundsPayableAccount(balances.Container.Payments.Container.Settings.DefaultProvider, topUp.Currency), Direction: ledgermodels.Credit, AmountMinor: portion},
		},
	}); err != nil {
		return err
	}
	if _, err := balances.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
		PaymentIntentId: topUp.PaymentIntentID, AmountMinor: portion, Currency: topUp.Currency, Reference: reference, Reason: "unused ad balance",
	}); err != nil {
		return err
	}
	return topUp.Update().AddRefundedMinor(portion).Exec(ctx)
}

func itoa(value int64) string {
	return strconv.FormatInt(value, 10)
}
