package services

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/payoutaccount"
	"zudomart/modules/wallet/src/generated/ent/withdrawal"
	"zudomart/modules/wallet/src/modules/payouts"
	requestwithdrawal "zudomart/modules/wallet/src/modules/payouts/commands/requestWithdrawal"
	payoutservices "zudomart/modules/wallet/src/modules/payouts/services"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

var (
	ErrInsufficientAvailableBalance = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_AVAILABLE_BALANCE", "The amount plus the transfer fee is more than your available balance.")
	ErrPayoutBelowMinimum           = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amountMinor", Message: "is below the minimum payout"}})
)

type SellerPayouts struct {
	Payouts *payouts.Application
}

func (sellerPayouts SellerPayouts) MinimumPayoutMinor(currency string) int64 {
	settings := sellerPayouts.Payouts.Container.Settings
	if minimum, found := settings.MinimumPayoutMinorByCurrency[currency]; found && minimum > settings.MinimumWithdrawalMinor {
		return minimum
	}
	return settings.MinimumWithdrawalMinor
}

func (sellerPayouts SellerPayouts) ReadPayoutSettings(ctx context.Context, seller dtos.SellerContext, scheduleLabel string) (dtos.PayoutSettingsView, error) {
	minimum := sellerPayouts.MinimumPayoutMinor(seller.Currency)
	fee, err := sellerPayouts.Payouts.Container.Payments.QuotePayoutFee(seller.Currency, minimum)
	if err != nil {
		return dtos.PayoutSettingsView{}, payoutservices.ErrWithdrawalCurrency
	}
	return dtos.PayoutSettingsView{MinimumPayout: seller.Money(minimum), Fee: seller.Money(fee), Schedule: scheduleLabel}, nil
}

func (sellerPayouts SellerPayouts) ListPayouts(ctx context.Context, seller dtos.SellerContext, after *uuid.UUID, limit int) (httpserver.CursorPage[dtos.PayoutView], error) {
	client := sellerPayouts.Payouts.Container.Client(sellerPayouts.Payouts.Container.Resources.Database)
	query := client.Withdrawal.Query().Where(withdrawal.UserID(seller.SellerId), withdrawal.Currency(seller.Currency))
	if after != nil {
		query = query.Where(withdrawal.IDLT(*after))
	}
	rows, err := query.Order(ent.Desc(withdrawal.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.PayoutView]{}, err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	views := make([]dtos.PayoutView, 0, len(rows))
	for _, row := range rows {
		views = append(views, PayoutViewOf(row))
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

func PayoutViewOf(row *ent.Withdrawal) dtos.PayoutView {
	status := "processing"
	switch row.Status {
	case withdrawal.StatusPaid:
		status = "paid"
	case withdrawal.StatusFailed, withdrawal.StatusCancelled:
		status = "failed"
	}
	var completed *string
	if row.ProcessedAt != nil && status != "processing" {
		completed = formatOptionalTime(row.ProcessedAt)
	}
	return dtos.PayoutView{
		Id: row.ID.String(), Amount: moneyOf(row.NetMinor, row.Currency), Fee: moneyOf(row.FeeMinor, row.Currency), AccountId: row.PayoutAccountID.String(),
		AccountSummary: row.DestinationLabel, Status: status, Reference: row.Reference, RequestedAt: row.CreatedAt.UTC().Format(time.RFC3339), CompletedAt: completed,
	}
}

func (sellerPayouts SellerPayouts) RequestPayout(ctx context.Context, seller dtos.SellerContext, body dtos.RequestPayoutBody, idempotencyKey string) (dtos.PayoutView, bool, error) {
	if body.AmountMinor < sellerPayouts.MinimumPayoutMinor(seller.Currency) {
		return dtos.PayoutView{}, false, ErrPayoutBelowMinimum
	}
	accountId := uuid.MustParse(body.AccountId)
	client := sellerPayouts.Payouts.Container.Client(sellerPayouts.Payouts.Container.Resources.Database)
	if exists, err := client.PayoutAccount.Query().Where(payoutaccount.ID(accountId), payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil()).Exist(ctx); err != nil || !exists {
		if err != nil {
			return dtos.PayoutView{}, false, err
		}
		return dtos.PayoutView{}, false, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "must be one of your payout accounts"}})
	}
	gross, err := sellerPayouts.grossForNetAmount(seller.Currency, body.AmountMinor)
	if err != nil {
		return dtos.PayoutView{}, false, err
	}
	created, replayed, err := requestwithdrawal.Handler{Application: sellerPayouts.Payouts}.Execute(ctx, requestwithdrawal.Command{
		UserId: seller.SellerId, PayoutAccountId: accountId, AmountMinor: gross, Currency: seller.Currency, IdempotencyKey: "seller-payout-" + idempotencyKey,
	})
	if errors.Is(err, payoutservices.ErrInsufficientFunds) {
		return dtos.PayoutView{}, false, ErrInsufficientAvailableBalance
	}
	if err != nil {
		return dtos.PayoutView{}, false, err
	}
	row, err := client.Withdrawal.Get(ctx, uuid.MustParse(created.Id))
	if err != nil {
		return dtos.PayoutView{}, false, err
	}
	return PayoutViewOf(row), replayed, nil
}

func (sellerPayouts SellerPayouts) grossForNetAmount(currency string, netMinor int64) (int64, error) {
	payments := sellerPayouts.Payouts.Container.Payments
	fee, err := payments.QuotePayoutFee(currency, netMinor)
	if err != nil {
		return 0, payoutservices.ErrWithdrawalCurrency
	}
	for attempt := 0; attempt < 3; attempt++ {
		feeOnGross, quoteError := payments.QuotePayoutFee(currency, netMinor+fee)
		if quoteError != nil {
			return 0, payoutservices.ErrWithdrawalCurrency
		}
		if feeOnGross == fee {
			break
		}
		fee = feeOnGross
	}
	return netMinor + fee, nil
}
