package changeboostbudget

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboostchange"
	"nantty/modules/ads/src/generated/ent/adtopup"
	"nantty/modules/ads/src/interfaces"
)

func changeTopUpKey(command Command) string {
	digest := sha256.Sum256([]byte(command.UserId.String() + ":boost-change:" + command.IdempotencyKey))
	return "boost-change-" + hex.EncodeToString(digest[:20])
}

func (handler Handler) openCardCheckout(ctx context.Context, command Command, change *ent.AdBoostChange) (string, error) {
	deployed := handler.Container
	boost, err := deployed.Client.AdBoost.Get(ctx, change.BoostID)
	if err != nil {
		return "", err
	}
	started, err := deployed.TopUps.StartTopUp(ctx, interfaces.TopUpStartRequest{
		UserId: change.UserID.String(), IdempotencyKey: changeTopUpKey(command), AdAccountId: boost.AccountID.String(), AmountMinor: change.AdditionalMinor, Currency: change.Currency,
	})
	if err != nil {
		return "", err
	}
	provider := started.Provider
	if provider == "" {
		provider = "flutterwave"
	}
	err = deployed.Client.AdTopUp.Create().SetAccountID(boost.AccountID).SetMoneyTopUpID(started.TopUpId).SetReference(started.Reference).SetAmountMinor(change.AdditionalMinor).
		SetCurrency(change.Currency).SetProvider(provider).SetAuthorizationURL(started.CheckoutUrl).SetRequestedByUserID(change.UserID).
		OnConflictColumns(adtopup.FieldMoneyTopUpID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if change.PaymentTopUpID != started.TopUpId {
		if err := deployed.Client.AdBoostChange.Update().Where(adboostchange.ID(change.ID), adboostchange.StatusEQ(adboostchange.StatusPendingPayment)).SetPaymentTopUpID(started.TopUpId).Exec(ctx); err != nil {
			return "", err
		}
	}
	return started.CheckoutUrl, nil
}
