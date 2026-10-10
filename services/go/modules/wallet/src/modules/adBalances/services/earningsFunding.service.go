package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/adbalanceearningstransfer"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
	"zudomart/platform/httpserver"
)

var ErrInsufficientEarnings = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_FUNDS", "Amount is more than your available balance.")

type EarningsFundingRequest struct {
	UserId         string
	AdAccountId    string
	Amount         dtos.MoneyDto
	IdempotencyKey string
	AnnounceTopUp  bool
}

func lockAdvisory(ctx context.Context, transaction *sql.Tx, key string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", key)
	return err
}

func lockUserCash(ctx context.Context, transaction *sql.Tx, userId, currency string) error {
	return lockAdvisory(ctx, transaction, "wallet-cash:"+userId+":"+currency)
}

func (balances AdBalances) FundFromEarnings(ctx context.Context, request EarningsFundingRequest) (dtos.EarningsFundingDto, error) {
	if err := balances.Container.Payments.RequireVerificationLevel(ctx, request.UserId, paymentmodels.VerificationLevelPayout); err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	var result dtos.EarningsFundingDto
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		result, err = balances.fundFromEarningsInTransaction(ctx, transaction, request)
		return err
	})
	return result, err
}

func (balances AdBalances) fundFromEarningsInTransaction(ctx context.Context, transaction *sql.Tx, request EarningsFundingRequest) (dtos.EarningsFundingDto, error) {
	currency, amount := request.Amount.Currency, request.Amount.AmountMinor
	if err := lockUserCash(ctx, transaction, request.UserId, currency); err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	client := balances.Container.Client(transaction)
	existing, err := client.AdBalanceEarningsTransfer.Query().
		Where(adbalanceearningstransfer.UserID(request.UserId), adbalanceearningstransfer.IdempotencyKey(request.IdempotencyKey)).Only(ctx)
	if err == nil {
		if existing.AdAccountID != request.AdAccountId || existing.AmountMinor != amount || existing.Currency != currency {
			return dtos.EarningsFundingDto{}, ErrIdempotencyKeyReused
		}
		converted := convertEarningsTransfer(existing)
		converted.Replayed = true
		return converted, nil
	}
	if !ent.IsNotFound(err) {
		return dtos.EarningsFundingDto{}, err
	}
	if err := lockAdvisory(ctx, transaction, "ad-balance:"+request.AdAccountId); err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	withdrawable, err := balances.readWithdrawableMinor(ctx, transaction, request.UserId, currency)
	if err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	if amount <= 0 || amount > withdrawable {
		return dtos.EarningsFundingDto{}, ErrInsufficientEarnings
	}
	created, err := client.AdBalanceEarningsTransfer.Create().SetAdAccountID(request.AdAccountId).SetUserID(request.UserId).SetIdempotencyKey(request.IdempotencyKey).
		SetAmountMinor(amount).SetCurrency(currency).SetCreatedAt(balances.Container.Now()).Save(ctx)
	if err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	_, err = balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "ad-earnings-funding:" + created.ID.String(), Kind: "adBalance.fundedFromEarnings", Description: "Ads paid from your Zudomart balance",
		Metadata: map[string]any{"adAccountId": request.AdAccountId, "fundingId": created.ID.String()},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.SellerAvailableAccount(request.UserId, currency), Direction: ledgermodels.Debit, AmountMinor: amount},
			{Account: ledgermodels.AdvertiserPrepaidBalanceAccount(request.AdAccountId, currency), Direction: ledgermodels.Credit, AmountMinor: amount},
		},
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return dtos.EarningsFundingDto{}, ErrInsufficientEarnings
	}
	if err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	if request.AnnounceTopUp {
		if err := balances.Container.Outbox.EnqueueInTransaction(ctx, transaction, "adBalance.toppedUp", request.AdAccountId, balances.Container.Now().UTC(), map[string]any{
			"adAccountId": request.AdAccountId, "topUpId": created.ID.String(), "fundedByUserId": request.UserId, "source": "earnings",
			"amount": map[string]any{"amountMinor": amount, "currency": currency},
		}); err != nil {
			return dtos.EarningsFundingDto{}, err
		}
	}
	return convertEarningsTransfer(created), nil
}

func (balances AdBalances) readWithdrawableMinor(ctx context.Context, executor databases.ExecutorQuerier, userId, currency string) (int64, error) {
	accounts := []ledgermodels.AccountRef{
		ledgermodels.SellerAvailableAccount(userId, currency), ledgermodels.SellerDebtAccount(userId, currency), ledgermodels.CreatorEarningsDebtAccount(userId, currency),
	}
	found, err := balances.Container.Ledger.ReadAccountBalances(ctx, executor, accounts)
	if err != nil {
		return 0, err
	}
	debts := max(found[accounts[1].Key()], 0) + max(found[accounts[2].Key()], 0)
	return max(found[accounts[0].Key()]-debts, 0), nil
}

func (balances AdBalances) DebitEarningsForBoost(ctx context.Context, request dtos.BoostDebitRequestDto) (dtos.BoostDebitResultDto, error) {
	if err := balances.Container.Payments.RequireVerificationLevel(ctx, request.UserId, paymentmodels.VerificationLevelPayout); err != nil {
		return dtos.BoostDebitResultDto{}, err
	}
	var result dtos.BoostDebitResultDto
	err := databases.RunInMoneyTransaction(ctx, balances.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := balances.fundFromEarningsInTransaction(ctx, transaction, EarningsFundingRequest{
			UserId: request.UserId, AdAccountId: BoostAdAccountId(request.UserId), Amount: request.Amount, IdempotencyKey: "boost:" + request.IdempotencyKey,
		}); err != nil {
			return err
		}
		var err error
		result, err = balances.moveBoostFundsInTransaction(ctx, transaction, request, "boost-debit:", false)
		return err
	})
	return result, err
}

func (balances AdBalances) returnEarningsFundedBoostRefund(ctx context.Context, transaction *sql.Tx, request dtos.BoostDebitRequestDto) (int64, error) {
	client := balances.Container.Client(transaction)
	transfer, err := client.AdBalanceEarningsTransfer.Query().
		Where(adbalanceearningstransfer.UserID(request.UserId), adbalanceearningstransfer.IdempotencyKey("boost:"+request.DebitIdempotencyKey)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	portion := min(request.Amount.AmountMinor, transfer.AmountMinor-transfer.RefundedMinor)
	if portion <= 0 {
		return 0, nil
	}
	return portion, balances.returnEarningsCredit(ctx, transaction, transfer, portion, "ad-earnings-refund:"+request.UserId+":"+request.IdempotencyKey)
}

func (balances AdBalances) returnEarningsCredit(ctx context.Context, transaction *sql.Tx, transfer *ent.AdBalanceEarningsTransfer, portion int64, reference string) error {
	if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "adBalance.earningsReturned", Description: "Unused ad credit returned to your balance",
		Metadata: map[string]any{"adAccountId": transfer.AdAccountID, "fundingId": transfer.ID.String()},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.AdvertiserPrepaidBalanceAccount(transfer.AdAccountID, transfer.Currency), Direction: ledgermodels.Debit, AmountMinor: portion},
			{Account: ledgermodels.SellerAvailableAccount(transfer.UserID, transfer.Currency), Direction: ledgermodels.Credit, AmountMinor: portion},
		},
	}); err != nil {
		return err
	}
	return transfer.Update().AddRefundedMinor(portion).Exec(ctx)
}

func convertEarningsTransfer(transfer *ent.AdBalanceEarningsTransfer) dtos.EarningsFundingDto {
	return dtos.EarningsFundingDto{
		FundingId: transfer.ID.String(), AdAccountId: transfer.AdAccountID, Status: "succeeded", CreatedAt: transfer.CreatedAt,
		Amount: dtos.MoneyDto{AmountMinor: transfer.AmountMinor, Currency: transfer.Currency},
	}
}
