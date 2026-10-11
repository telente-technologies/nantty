package createboost

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adtopup"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/types"
)

func freeBoostCap(capMinor int64, command Command) types.Money {
	return types.Money{AmountMinor: capMinor, Currency: command.Request.DailyBudget.Currency}
}

func boostTopUpKey(command Command) string {
	digest := sha256.Sum256([]byte(command.UserId.String() + ":" + command.IdempotencyKey))
	return "boost-" + hex.EncodeToString(digest[:20])
}

func (handler Handler) openCardCheckout(ctx context.Context, command Command, boost *ent.AdBoost, account *ent.AdAccount) (string, error) {
	deployed := handler.Container
	started, err := deployed.TopUps.StartTopUp(ctx, interfaces.TopUpStartRequest{
		UserId: boost.UserID.String(), IdempotencyKey: boostTopUpKey(command), AdAccountId: account.ID.String(), AmountMinor: boost.TotalBudgetMinor, Currency: boost.Currency,
	})
	if err != nil {
		return "", err
	}
	err = deployed.Client.AdTopUp.Create().SetAccountID(account.ID).SetMoneyTopUpID(started.TopUpId).SetReference(started.Reference).SetAmountMinor(boost.TotalBudgetMinor).
		SetCurrency(boost.Currency).SetProvider(boostTopUpProvider(started.Provider)).SetAuthorizationURL(started.CheckoutUrl).SetRequestedByUserID(boost.UserID).
		OnConflictColumns(adtopup.FieldMoneyTopUpID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if boost.PaymentTopUpID != started.TopUpId {
		if err := deployed.Client.AdBoost.Update().Where(adboost.ID(boost.ID), adboost.StatusEQ(adboost.StatusPendingPayment)).SetPaymentTopUpID(started.TopUpId).Exec(ctx); err != nil {
			return "", err
		}
	}
	return started.CheckoutUrl, nil
}

func boostTopUpProvider(started string) string {
	if started != "" {
		return started
	}
	return "flutterwave"
}
