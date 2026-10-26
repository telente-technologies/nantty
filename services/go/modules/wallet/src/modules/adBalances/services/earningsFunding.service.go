package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/adbalanceearningstransfer"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/platform/httpserver"
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
	created, err := client.AdBalanceEarningsTransfer.Create().SetAdAccountID(request.AdAccountId).SetUserID(request.UserId).SetIdempotencyKey(request.IdempotencyKey).
		SetAmountMinor(amount).SetCurrency(currency).SetCreatedAt(balances.Container.Now()).Save(ctx)
	if err != nil {
		return dtos.EarningsFundingDto{}, err
	}
	_, err = balances.Container.Payments.SpendWalletToPlatformInTransaction(ctx, transaction, paymentservices.WalletSpend{
		UserId: request.UserId, Currency: currency, AmountMinor: amount, Reference: "ad-earnings-funding:" + created.ID.String(), Subject: "ads:" + created.ID.String(),
		Description: "Ads paid from your wallet", Credit: ledgermodels.AdvertiserPrepaidBalanceAccount(request.AdAccountId, currency), NetDebts: true,
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) || errors.Is(err, paymentservices.ErrInsufficientWalletFunds) {
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
	if err := balances.Container.Payments.CreditWalletFromPlatformInTransaction(ctx, transaction, transfer.UserID, transfer.Currency, "ads:"+reference, reference, portion,
		ledgermodels.AdvertiserPrepaidBalanceAccount(transfer.AdAccountID, transfer.Currency), "Unused ad credit returned to your wallet"); err != nil {
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
