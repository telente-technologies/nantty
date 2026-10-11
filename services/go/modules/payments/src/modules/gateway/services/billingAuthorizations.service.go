package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/billingauthorization"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/payments/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/secretbox"
)

var ErrBillingAuthorizationMissing = httpserver.NewApiError(http.StatusConflict, "BILLING_CARD_MISSING", "Add a card to keep your plan.")

const (
	BillingChargeSucceeded      = "succeeded"
	BillingChargeFailed         = "failed"
	BillingChargeRequiresAction = "requires_action"
	BillingChargePending        = "pending"
)

type BillingAuthorizationCharge struct {
	OwnerUserId     string
	AuthorizationId string
	SubjectId       string
	Reference       string
	AmountMinor     int64
	Currency        string
	Metadata        map[string]string
}

type BillingAuthorizationChargeResult struct {
	Status        string
	Reference     string
	FailureReason string
	ActionUrl     string
	Settled       bool
}

type BillingCardSummary struct {
	Label       string
	ExpiryMonth int
	ExpiryYear  int
	Usable      bool
}

func (gateway *PaymentGateway) StoreBillingAuthorizationInTransaction(ctx context.Context, transaction *sql.Tx, userId, provider, customerId string, card *models.CardAuthorizationHandoff) (string, error) {
	key := gateway.Container.Settings.DataEncryptionKey
	if card == nil || !card.Reusable || card.AuthorizationCode == "" || len(key) != 32 {
		return "", nil
	}
	sealed, err := secretbox.SealWithAesGcm(key, []byte(card.AuthorizationCode))
	if err != nil {
		return "", err
	}
	fingerprint := utils.HashSavedCardFingerprint(gateway.Container.Settings.SavedCardFingerprintKey, card.Signature, card.Brand, card.Last4, card.ExpiryMonth, card.ExpiryYear)
	client := gateway.Container.Client(transaction)
	existing, err := client.BillingAuthorization.Query().Where(billingauthorization.UserID(userId), billingauthorization.CardFingerprintHash(fingerprint)).ForUpdate().Only(ctx)
	if err == nil {
		if existing.TokenEmail != "" && card.TokenEmail != "" && existing.TokenEmail != card.TokenEmail {
			return existing.ID.String(), nil
		}
		return existing.ID.String(), existing.Update().SetSealedAuthorization(sealed).SetProviderCustomerID(customerId).ClearRevokedAt().SetTokenEmail(card.TokenEmail).
			SetCardExpiryMonth(card.ExpiryMonth).SetCardExpiryYear(card.ExpiryYear).Exec(ctx)
	}
	if !ent.IsNotFound(err) {
		return "", err
	}
	created, err := client.BillingAuthorization.Create().SetID(uuid.Must(uuid.NewV7())).SetUserID(userId).SetProvider(provider).SetProviderCustomerID(customerId).
		SetSealedAuthorization(sealed).SetTokenEmail(card.TokenEmail).SetCardFingerprintHash(fingerprint).SetCardBrand(truncate(card.Brand, 30)).SetCardLast4(truncate(card.Last4, 4)).
		SetCardExpiryMonth(card.ExpiryMonth).SetCardExpiryYear(card.ExpiryYear).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return "", err
	}
	return created.ID.String(), nil
}

func (gateway *PaymentGateway) DescribeBillingAuthorization(ctx context.Context, authorizationId string) (BillingCardSummary, error) {
	id, err := uuid.Parse(authorizationId)
	if err != nil {
		return BillingCardSummary{}, ErrBillingAuthorizationMissing
	}
	row, err := gateway.Container.Client(gateway.Container.Resources.Database).BillingAuthorization.Get(ctx, id)
	if ent.IsNotFound(err) {
		return BillingCardSummary{}, ErrBillingAuthorizationMissing
	}
	if err != nil {
		return BillingCardSummary{}, err
	}
	return BillingCardSummary{Label: SavedCardLabel(row.CardBrand, row.CardLast4), ExpiryMonth: row.CardExpiryMonth, ExpiryYear: row.CardExpiryYear, Usable: row.RevokedAt == nil}, nil
}

func (gateway *PaymentGateway) ChargeBillingAuthorization(ctx context.Context, request BillingAuthorizationCharge) (BillingAuthorizationChargeResult, error) {
	result := BillingAuthorizationChargeResult{Reference: request.Reference}
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	existing, err := client.PaymentIntent.Query().Where(paymentintent.Reference(request.Reference)).Only(ctx)
	if err == nil {
		return gateway.settleBillingCharge(ctx, existing.Reference, result)
	}
	if !ent.IsNotFound(err) {
		return result, err
	}
	authorization, code, err := gateway.openBillingAuthorization(ctx, request.OwnerUserId, request.AuthorizationId)
	if err != nil {
		return result, err
	}
	contact, err := gateway.requireVerifiedContact(ctx, request.OwnerUserId)
	if err != nil {
		return result, err
	}
	provider, err := gateway.Container.SavedCards(authorization.Provider)
	if err != nil {
		return result, err
	}
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: constants.PurposeSubscriptionRenewal, OwnerUserId: request.OwnerUserId, SubjectId: request.SubjectId, Provider: authorization.Provider,
			AmountMinor: request.AmountMinor, Currency: request.Currency, Metadata: request.Metadata, Reference: request.Reference,
		})
		return err
	})
	if errors.Is(err, ErrAlreadyPaid) {
		result.Status, result.Settled = BillingChargeSucceeded, true
		return result, nil
	}
	if err != nil {
		return result, err
	}
	charged, err := provider.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{
		CustomerEmail: pinnedTokenEmail(authorization, contact.Email), AuthorizationCode: code, Reference: request.Reference, AmountMinor: request.AmountMinor, Currency: request.Currency, Metadata: request.Metadata,
	})
	_ = client.BillingAuthorization.UpdateOneID(authorization.ID).SetLastUsedAt(gateway.Container.Now()).Exec(ctx)
	if errors.Is(err, interfaces.ErrSavedCardNotForCustomer) {
		_ = client.BillingAuthorization.UpdateOneID(authorization.ID).SetRevokedAt(gateway.Container.Now()).Exec(ctx)
		result.Status, result.FailureReason = BillingChargeFailed, "The saved card can no longer be charged."
		return result, nil
	}
	if err != nil {
		return result, convertProviderError(err)
	}
	if charged.Paused {
		result.Status, result.ActionUrl, result.FailureReason = BillingChargeRequiresAction, charged.AuthorizationUrl, "Your bank asked you to confirm this payment."
		return result, nil
	}
	return gateway.settleBillingCharge(ctx, request.Reference, result)
}

func (gateway *PaymentGateway) settleBillingCharge(ctx context.Context, reference string, result BillingAuthorizationChargeResult) (BillingAuthorizationChargeResult, error) {
	settled, err := gateway.VerifyAndSettlePaymentIntentByReference(ctx, reference)
	if err != nil {
		return result, err
	}
	switch settled.Status {
	case string(paymentintent.StatusSucceeded):
		result.Status, result.Settled = BillingChargeSucceeded, true
	case string(paymentintent.StatusFailed):
		result.Status, result.Settled = BillingChargeFailed, true
		if intent, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx); err == nil {
			result.FailureReason = intent.FailureReason
		}
	default:
		result.Status = BillingChargePending
	}
	return result, nil
}

func (gateway *PaymentGateway) openBillingAuthorization(ctx context.Context, userId, authorizationId string) (*ent.BillingAuthorization, string, error) {
	id, err := uuid.Parse(authorizationId)
	if err != nil {
		return nil, "", ErrBillingAuthorizationMissing
	}
	row, err := gateway.Container.Client(gateway.Container.Resources.Database).BillingAuthorization.Query().
		Where(billingauthorization.ID(id), billingauthorization.UserID(userId), billingauthorization.RevokedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, "", ErrBillingAuthorizationMissing
	}
	if err != nil {
		return nil, "", err
	}
	code, err := secretbox.OpenWithAesGcm(gateway.Container.Settings.DataEncryptionKey, row.SealedAuthorization)
	if err != nil {
		return nil, "", ErrBillingAuthorizationMissing
	}
	return row, string(code), nil
}

func pinnedTokenEmail(authorization *ent.BillingAuthorization, accountEmail string) string {
	if authorization.TokenEmail != "" {
		return authorization.TokenEmail
	}
	return accountEmail
}
