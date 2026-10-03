package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type SavedCardChargeRequest struct {
	UserId                 string
	PaymentIntentReference string
	AuthorizationCode      string
}

type SavedCardChargeView struct {
	Status           string                   `json:"status"`
	CheckoutUrl      *string                  `json:"checkoutUrl"`
	AuthorizationUrl *string                  `json:"authorizationUrl"`
	PaymentIntent    models.PaymentIntentView `json:"paymentIntent"`
}

func (gateway *PaymentGateway) ChargePaymentIntentWithSavedCard(ctx context.Context, request SavedCardChargeRequest) (SavedCardChargeView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(request.PaymentIntentReference), paymentintent.OwnerUserID(request.UserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return SavedCardChargeView{}, ErrPaymentNotFound
	}
	if err != nil {
		return SavedCardChargeView{}, err
	}
	if intent.Status != paymentintent.StatusPending {
		return SavedCardChargeView{}, ErrAlreadyPaid
	}
	contact, err := gateway.requireVerifiedContact(ctx, request.UserId)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	if intent.AuthorizationURL != "" {
		return gateway.reissueIntentForHostedCheckout(ctx, intent)
	}
	metadata := map[string]string{}
	_ = json.Unmarshal(intent.Metadata, &metadata)
	delete(metadata, callbackUrlMetadataKey)
	result, err := provider.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{
		CustomerEmail: contact.Email, AuthorizationCode: request.AuthorizationCode, Reference: intent.Reference, AmountMinor: intent.AmountMinor,
		Currency: intent.Currency, SettlementAccount: intent.ConnectedAccountID, SubaccountBearsFee: gateway.Container.Settings.Paystack.SubaccountBearsFee, Metadata: metadata,
	})
	if errors.Is(err, interfaces.ErrSavedCardNotForCustomer) {
		return gateway.reissueIntentForHostedCheckout(ctx, intent)
	}
	if err != nil {
		return SavedCardChargeView{}, convertProviderError(err)
	}
	switch {
	case result.Paused:
		view := ConvertPaymentIntentToView(intent)
		url := result.AuthorizationUrl
		return SavedCardChargeView{Status: "requires_authentication", AuthorizationUrl: &url, PaymentIntent: view}, nil
	case result.Outcome == interfaces.OutcomeFailed:
		return gateway.reissueIntentForHostedCheckout(ctx, intent)
	}
	settled, err := gateway.VerifyAndSettlePaymentIntentByReference(ctx, intent.Reference)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	return SavedCardChargeView{Status: settled.Status, PaymentIntent: settled}, nil
}

func (gateway *PaymentGateway) reissueIntentForHostedCheckout(ctx context.Context, previous *ent.PaymentIntent) (SavedCardChargeView, error) {
	metadata := map[string]string{}
	_ = json.Unmarshal(previous.Metadata, &metadata)
	delete(metadata, callbackUrlMetadataKey)
	var reissued models.PaymentIntentView
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		reissued, err = gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: string(previous.Purpose), OwnerUserId: previous.OwnerUserID, SubjectId: previous.SubjectID, Provider: previous.Provider,
			AmountMinor: previous.AmountMinor, Currency: previous.Currency, BeneficiaryUserId: previous.BeneficiaryUserID, PlatformFeeMinor: previous.PlatformFeeMinor,
			Metadata: metadata, SettleToSellerSubaccount: previous.ConnectedAccountID != "",
		})
		return err
	})
	if err != nil {
		return SavedCardChargeView{}, err
	}
	opened, err := gateway.OpenProviderCheckoutForIntent(ctx, reissued.Id)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	return SavedCardChargeView{Status: "requires_checkout", CheckoutUrl: opened.CheckoutUrl, PaymentIntent: opened}, nil
}
