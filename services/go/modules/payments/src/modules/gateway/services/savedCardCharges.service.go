package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type SavedCardChargeRequest struct {
	UserId                 string
	PaymentIntentReference string
	SavedCardId            string
	IdempotencyKey         string
}

type savedCardChargeClaim struct {
	Claimed bool `json:"claimed"`
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
	provider, err := gateway.Container.SavedCards(intent.Provider)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	authorization, authorizationCode, err := gateway.openBillingAuthorization(ctx, request.UserId, request.SavedCardId)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	if authorization.Provider != intent.Provider {
		return SavedCardChargeView{}, ErrBillingAuthorizationMissing
	}
	if intent.AuthorizationURL != "" {
		return gateway.reissueIntentForHostedCheckout(ctx, intent)
	}
	claim, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, gateway.Container.Resources.Database, gateway.Container.Idempotency, ledgerutils.IdempotentCommand[savedCardChargeClaim]{
		Scope: request.UserId + ":savedCard.charge", Key: request.IdempotencyKey, RequestHash: ledgerutils.HashRequestFingerprint(request.PaymentIntentReference, request.SavedCardId),
		Execute: func(ctx context.Context, transaction *sql.Tx) (savedCardChargeClaim, error) {
			return gateway.claimSavedCardChargeInTransaction(ctx, transaction, intent.ID.String())
		},
	})
	if err != nil {
		return SavedCardChargeView{}, err
	}
	if replayed || !claim.Claimed {
		return gateway.savedCardChargeStatus(ctx, intent.Reference)
	}
	metadata := map[string]string{}
	_ = json.Unmarshal(intent.Metadata, &metadata)
	delete(metadata, callbackUrlMetadataKey)
	splitShares := SplitSharesForGroups(models.DecodeCheckoutGroups(metadata))
	delete(metadata, models.CheckoutGroupsMetadataKey)
	result, err := provider.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{
		SplitShares:   splitShares,
		CustomerEmail: pinnedTokenEmail(authorization, contact.Email), AuthorizationCode: authorizationCode, Reference: intent.Reference, AmountMinor: intent.AmountMinor,
		Currency: intent.Currency, SettlementAccount: intent.ConnectedAccountID, SubaccountBearsFee: gateway.Container.Settings.SubaccountBearsFee, Metadata: metadata,
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

func (gateway *PaymentGateway) claimSavedCardChargeInTransaction(ctx context.Context, transaction *sql.Tx, intentId string) (savedCardChargeClaim, error) {
	locked, err := gateway.Container.Client(transaction).PaymentIntent.Query().Where(paymentintent.ID(uuid.MustParse(intentId))).ForUpdate().Only(ctx)
	if err != nil {
		return savedCardChargeClaim{}, err
	}
	if locked.Status != paymentintent.StatusPending {
		return savedCardChargeClaim{}, ErrAlreadyPaid
	}
	if locked.SavedCardChargeStartedAt != nil {
		return savedCardChargeClaim{}, nil
	}
	return savedCardChargeClaim{Claimed: true}, locked.Update().SetSavedCardChargeStartedAt(gateway.Container.Now().UTC()).AddVersion(1).Exec(ctx)
}

func (gateway *PaymentGateway) savedCardChargeStatus(ctx context.Context, reference string) (SavedCardChargeView, error) {
	settled, err := gateway.VerifyAndSettlePaymentIntentByReference(ctx, reference)
	if err != nil {
		return SavedCardChargeView{}, err
	}
	status := settled.Status
	if status == string(paymentintent.StatusPending) {
		status = "processing"
	}
	return SavedCardChargeView{Status: status, PaymentIntent: settled}, nil
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
