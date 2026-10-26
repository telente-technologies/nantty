package services

import (
	"context"
	"database/sql"
	"net/http"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/adspenddebit"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/platform/httpserver"
)

var (
	ErrIdempotencyKeyReused = httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "This key was used for a different request.")
	ErrRefundAboveDebit     = httpserver.NewApiError(http.StatusUnprocessableEntity, "VALIDATION_FAILED", "The refund is larger than what is left of the debit.")
)

func boostHoldingAccount(currency string) ledgermodels.AccountRef {
	account := ledgermodels.PlatformAdRevenueAccount(currency)
	account.Code, account.Kind = "liability:adBoostHolding", ledgermodels.AccountKindLiability
	return account
}

func (balances AdBalances) DebitForBoost(ctx context.Context, request dtos.BoostDebitRequestDto) (dtos.BoostDebitResultDto, error) {
	return balances.moveBoostFunds(ctx, request, "boost-debit:", false)
}

func (balances AdBalances) RefundBoostRemainder(ctx context.Context, request dtos.BoostDebitRequestDto) (dtos.BoostDebitResultDto, error) {
	return balances.moveBoostFunds(ctx, request, "boost-refund:", true)
}

func (balances AdBalances) moveBoostFunds(ctx context.Context, request dtos.BoostDebitRequestDto, prefix string, refund bool) (dtos.BoostDebitResultDto, error) {
	var result dtos.BoostDebitResultDto
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		result, err = balances.moveBoostFundsInTransaction(ctx, transaction, request, prefix, refund)
		if err != nil || !refund || result.Replayed {
			return err
		}
		returned, err := balances.returnEarningsFundedBoostRefund(ctx, transaction, request)
		result.BalanceAfter.AmountMinor -= returned
		return err
	})
	return result, err
}

func (balances AdBalances) moveBoostFundsInTransaction(ctx context.Context, transaction *sql.Tx, request dtos.BoostDebitRequestDto, prefix string, refund bool) (dtos.BoostDebitResultDto, error) {
	adAccountId := BoostAdAccountId(request.UserId)
	key := prefix + request.UserId + ":" + request.IdempotencyKey
	prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, request.Amount.Currency)
	var result dtos.BoostDebitResultDto
	err := func() error {
		client := balances.Container.Client(transaction)
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "ad-balance:"+adAccountId); err != nil {
			return err
		}
		if existing, err := client.AdSpendDebit.Query().Where(adspenddebit.IdempotencyKey(key)).Only(ctx); err == nil {
			if existing.RequestedMinor != request.Amount.AmountMinor || existing.Currency != request.Amount.Currency {
				return ErrIdempotencyKeyReused
			}
			balance, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
			result = dtos.BoostDebitResultDto{LedgerTransactionId: key, BalanceAfter: dtos.MoneyDto{AmountMinor: balance, Currency: request.Amount.Currency}, Replayed: true}
			return err
		} else if !ent.IsNotFound(err) {
			return err
		}
		balance, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
		if err != nil {
			return err
		}
		lines := []ledgermodels.JournalLineRequest{
			{Account: prepaid, Direction: ledgermodels.Debit, AmountMinor: request.Amount.AmountMinor},
			{Account: boostHoldingAccount(request.Amount.Currency), Direction: ledgermodels.Credit, AmountMinor: request.Amount.AmountMinor},
		}
		if refund {
			debit, err := client.AdSpendDebit.Query().Where(adspenddebit.IdempotencyKey("boost-debit:" + request.UserId + ":" + request.DebitIdempotencyKey)).Only(ctx)
			if err != nil {
				return ErrRefundAboveDebit
			}
			refunded, err := client.AdSpendDebit.Query().Where(adspenddebit.BatchID("refund:" + debit.IdempotencyKey)).Aggregate(ent.Sum(adspenddebit.FieldDebitedMinor)).Int(ctx)
			if err != nil && !ent.IsNotFound(err) {
				refunded = 0
			}
			if request.Amount.AmountMinor > debit.DebitedMinor-int64(refunded) {
				return ErrRefundAboveDebit
			}
			lines[0].Direction, lines[1].Direction = ledgermodels.Credit, ledgermodels.Debit
			balance += request.Amount.AmountMinor
		} else {
			if balance < request.Amount.AmountMinor {
				return ErrInsufficientFunds
			}
			balance -= request.Amount.AmountMinor
		}
		batchId := "boost"
		if refund {
			batchId = "refund:boost-debit:" + request.UserId + ":" + request.DebitIdempotencyKey
		}
		if err := client.AdSpendDebit.Create().SetBatchID(batchId).SetIdempotencyKey(key).SetAdAccountID(adAccountId).SetCurrency(request.Amount.Currency).
			SetRequestedMinor(request.Amount.AmountMinor).SetDebitedMinor(request.Amount.AmountMinor).SetShortfallMinor(0).SetCreatedAt(balances.Container.Now()).Exec(ctx); err != nil {
			return err
		}
		posted, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: key, Kind: "adBoost.funded", Description: "Boost budget", Lines: lines})
		if err != nil {
			return err
		}
		result = dtos.BoostDebitResultDto{LedgerTransactionId: posted.Id.String(), BalanceAfter: dtos.MoneyDto{AmountMinor: balance, Currency: request.Amount.Currency}}
		return nil
	}()
	return result, err
}
