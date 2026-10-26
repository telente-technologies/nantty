package services

import (
	"context"
	"database/sql"
	"net/http"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/adspenddebit"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/platform/httpserver"
)

var (
	ErrWithdrawalAboveLedgerBalance = httpserver.NewApiError(http.StatusUnprocessableEntity, "WITHDRAWAL_ABOVE_AVAILABLE", "The ad balance on record is less than this withdrawal.")
	ErrWithdrawalInvalid            = httpserver.NewApiError(http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Send a positive amount, a fee no larger than it, and an idempotency key.")
)

func creditOffsetAccount(kind, source, currency string) ledgermodels.AccountRef {
	switch {
	case kind == "cashback" || source == "cashback":
		return ledgermodels.PlatformAdCashbackExpenseAccount(currency)
	case source == "boost_refund":
		return ledgermodels.PlatformAdsPaidWithCreditRevenueAccount(currency)
	}
	return ledgermodels.PlatformAdCreditIssuedExpenseAccount(currency)
}

func (balances AdBalances) ApplyAdCreditChange(ctx context.Context, change dtos.AdCreditChangeDto) error {
	if change.AmountMinor == 0 || change.AccountId == "" || change.Currency == "" || change.IdempotencyKey == "" {
		return nil
	}
	return databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := lockAdvisory(ctx, transaction, "ad-credit:"+change.AccountId); err != nil {
			return err
		}
		credit := ledgermodels.AdvertiserAdCreditAccount(change.AccountId, change.Currency)
		offset := creditOffsetAccount(change.Kind, change.Source, change.Currency)
		amount := change.AmountMinor
		lines := []ledgermodels.JournalLineRequest{{Account: offset, Direction: ledgermodels.Debit, AmountMinor: amount}, {Account: credit, Direction: ledgermodels.Credit, AmountMinor: amount}}
		if amount < 0 {
			held, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, credit)
			if err != nil {
				return err
			}
			amount = min(-amount, max(held, 0))
			if amount == 0 {
				return nil
			}
			lines = []ledgermodels.JournalLineRequest{{Account: credit, Direction: ledgermodels.Debit, AmountMinor: amount}, {Account: offset, Direction: ledgermodels.Credit, AmountMinor: amount}}
		}
		_, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "ad-credit-" + change.IdempotencyKey, Kind: "adCredit." + change.Kind, ExternalReference: change.LotId, Description: "Ad credit " + change.Kind, Lines: lines,
		})
		return err
	})
}

func (balances AdBalances) postCreditSpendInTransaction(ctx context.Context, transaction *sql.Tx, batch dtos.SpendBatchRequestDto) error {
	if batch.CreditDebitMinor <= 0 {
		return nil
	}
	credit := ledgermodels.AdvertiserAdCreditAccount(batch.AccountId, batch.Currency)
	held, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, credit)
	if err != nil {
		return err
	}
	amount := min(batch.CreditDebitMinor, max(held, 0))
	if amount == 0 {
		return nil
	}
	_, err = balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "ad-credit-spend-" + batch.IdempotencyKey, Kind: "adCredit.spent", ExternalReference: batch.BatchId, Description: "Ad spend paid with ad credit",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: credit, Direction: ledgermodels.Debit, AmountMinor: amount},
			{Account: ledgermodels.PlatformAdsPaidWithCreditRevenueAccount(batch.Currency), Direction: ledgermodels.Credit, AmountMinor: amount},
		},
	})
	return err
}

func (balances AdBalances) ApplySpendRefund(ctx context.Context, refund dtos.AdSpendRefundDto) error {
	if refund.BalanceMinor <= 0 {
		return nil
	}
	return databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := lockAdvisory(ctx, transaction, "ad-balance:"+refund.AccountId); err != nil {
			return err
		}
		_, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "ad-spend-refund-" + refund.IdempotencyKey, Kind: "adBalance.spendRefunded", ExternalReference: refund.BatchId, Description: "Ad spend refunded to the ad balance",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.PlatformAdRevenueAccount(refund.Currency), Direction: ledgermodels.Debit, AmountMinor: refund.BalanceMinor},
				{Account: ledgermodels.AdvertiserPrepaidBalanceAccount(refund.AccountId, refund.Currency), Direction: ledgermodels.Credit, AmountMinor: refund.BalanceMinor},
			},
		})
		return err
	})
}

func (balances AdBalances) WithdrawAdBalanceToWallet(ctx context.Context, adAccountId string, request dtos.AdBalanceWithdrawalRequestDto) (dtos.AdBalanceWithdrawalResultDto, error) {
	if request.GrossMinor <= 0 || request.FeeMinor < 0 || request.FeeMinor > request.GrossMinor || request.IdempotencyKey == "" || request.UserId == "" {
		return dtos.AdBalanceWithdrawalResultDto{}, ErrWithdrawalInvalid
	}
	if err := balances.Container.Payments.RequireVerificationLevel(ctx, request.UserId, paymentmodels.VerificationLevelPayout); err != nil {
		return dtos.AdBalanceWithdrawalResultDto{}, err
	}
	net := request.GrossMinor - request.FeeMinor
	result := dtos.AdBalanceWithdrawalResultDto{GrossMinor: request.GrossMinor, FeeMinor: request.FeeMinor, NetMinor: net}
	key := "ad-withdrawal:" + request.IdempotencyKey
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if err := lockAdvisory(ctx, transaction, "ad-balance:"+adAccountId); err != nil {
			return err
		}
		client := balances.Container.Client(transaction)
		if existing, err := client.AdSpendDebit.Query().Where(adspenddebit.IdempotencyKey(key)).Only(ctx); err == nil {
			if existing.RequestedMinor != request.GrossMinor || existing.Currency != request.Currency || existing.AdAccountID != adAccountId {
				return ErrIdempotencyKeyReused
			}
			result.Replayed = true
			return nil
		} else if !ent.IsNotFound(err) {
			return err
		}
		prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, request.Currency)
		held, err := balances.Container.Ledger.ReadAccountBalance(ctx, transaction, prepaid)
		if err != nil {
			return err
		}
		if held < request.GrossMinor {
			return ErrWithdrawalAboveLedgerBalance
		}
		if err := client.AdSpendDebit.Create().SetBatchID("withdrawal").SetIdempotencyKey(key).SetAdAccountID(adAccountId).SetCurrency(request.Currency).
			SetRequestedMinor(request.GrossMinor).SetDebitedMinor(request.GrossMinor).SetShortfallMinor(0).SetCreatedAt(balances.Container.Now()).Exec(ctx); err != nil {
			return err
		}
		if request.FeeMinor > 0 {
			if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
				Reference: key + ":fee", Kind: "adBalance.withdrawalFee", Description: "Ad balance withdrawal fee",
				Lines: []ledgermodels.JournalLineRequest{
					{Account: prepaid, Direction: ledgermodels.Debit, AmountMinor: request.FeeMinor},
					{Account: ledgermodels.PlatformAdBalanceWithdrawalFeeRevenueAccount(request.Currency), Direction: ledgermodels.Credit, AmountMinor: request.FeeMinor},
				},
			}); err != nil {
				return err
			}
		}
		if net == 0 {
			return nil
		}
		return balances.Container.Payments.CreditWalletFromPlatformInTransaction(ctx, transaction, request.UserId, request.Currency, "ads-withdrawal:"+request.IdempotencyKey, key, net,
			prepaid, "Ad balance withdrawn to your wallet")
	})
	return result, err
}
