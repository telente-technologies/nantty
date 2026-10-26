package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/billingauthorization"
	"nantty/modules/payments/src/generated/ent/providercustomer"
	"nantty/modules/payments/src/generated/ent/savedcardsetup"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/payments/src/utils"
	"nantty/platform/httpserver"
)

var (
	ErrSavedCardSetupNotFound = httpserver.NewApiError(http.StatusNotFound, "SAVED_CARD_SETUP_NOT_FOUND", "We could not find that card setup.")
	ErrSavedCardNotReady      = httpserver.NewApiError(http.StatusConflict, "SAVED_CARD_NOT_READY", "Your card is still being saved. Try again in a moment.")
	ErrSavedCardHandoffGone   = httpserver.NewApiError(http.StatusGone, "SAVED_CARD_HANDOFF_EXPIRED", "This card can no longer be added to the device. Save it again.")
	ErrSavedCardRejected      = httpserver.NewApiError(http.StatusForbidden, "SAVED_CARD_REJECTED", "This card cannot be used with your account.")
)

type StartedSavedCardSetup struct {
	Reference          string           `json:"reference"`
	CheckoutUrl        string           `json:"checkoutUrl"`
	VerificationCharge models.MoneyView `json:"verificationCharge"`
	ExpiresAt          *time.Time       `json:"expiresAt"`
}

type DeviceSavedCard struct {
	SavedCardId string `json:"savedCardId"`
	Brand       string `json:"brand"`
	Last4       string `json:"last4"`
	ExpiryMonth int    `json:"expiryMonth"`
	ExpiryYear  int    `json:"expiryYear"`
}

type CardSetupRequest struct {
	UserId      string
	ReturnTo    string
	Purpose     string
	SubjectId   string
	Metadata    map[string]string
	AmountMinor int64
	Currency    string
}

func (gateway *PaymentGateway) StartSavedCardSetup(ctx context.Context, request CardSetupRequest) (StartedSavedCardSetup, error) {
	setupId := uuid.Must(uuid.NewV7())
	amount, currency := gateway.Container.Settings.CardVerificationAmount, "NGN"
	if request.AmountMinor > 0 && request.Currency != "" {
		amount, currency = request.AmountMinor, request.Currency
	}
	purpose := firstNonEmpty(request.Purpose, "device")
	var intentId uuid.UUID
	var reference string
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		metadata := map[string]string{"savedCardSetupId": setupId.String(), "setupPurpose": purpose, "subjectId": request.SubjectId}
		for key, value := range request.Metadata {
			metadata[key] = value
		}
		intent, err := gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: constants.PurposeCardVerification, OwnerUserId: request.UserId, SubjectId: setupId.String(), AmountMinor: amount, Currency: currency,
			ReturnTo: request.ReturnTo, Metadata: metadata,
		})
		if err != nil {
			return err
		}
		intentId, reference = intent.Id, intent.Reference
		return gateway.Container.Client(transaction).SavedCardSetup.Create().SetID(setupId).SetReference(intent.Reference).SetUserID(request.UserId).
			SetProvider(intent.Provider).SetPurpose(purpose).SetSubjectID(request.SubjectId).SetCreatedAt(gateway.Container.Now()).Exec(ctx)
	})
	if err != nil {
		return StartedSavedCardSetup{}, err
	}
	opened, err := gateway.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return StartedSavedCardSetup{}, err
	}
	started := StartedSavedCardSetup{Reference: reference, VerificationCharge: models.MoneyView{AmountMinor: amount, Currency: currency}}
	if opened.CheckoutUrl != nil {
		started.CheckoutUrl = *opened.CheckoutUrl
	}
	return started, nil
}

type CardVerificationPayments struct {
	Gateway *PaymentGateway
}

func (handler CardVerificationPayments) HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment models.SettledPayment) error {
	return handler.Gateway.Container.Client(transaction).SavedCardSetup.Update().
		Where(savedcardsetup.ID(uuid.MustParse(payment.SubjectId)), savedcardsetup.StatusEQ(savedcardsetup.StatusPending)).SetStatus(savedcardsetup.StatusExpired).Exec(ctx)
}

func (handler CardVerificationPayments) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment models.SettledPayment) error {
	gateway := handler.Gateway
	client := gateway.Container.Client(transaction)
	setup, err := client.SavedCardSetup.Query().Where(savedcardsetup.ID(uuid.MustParse(payment.SubjectId))).ForUpdate().Only(ctx)
	if err != nil || setup.Status != savedcardsetup.StatusPending {
		return err
	}
	now := gateway.Container.Now().UTC()
	card := payment.Authorization
	update := setup.Update().SetStatus(savedcardsetup.StatusSaved).SetSavedAt(now).SetProviderCustomerID(payment.ProviderCustomerId)
	fingerprint := ""
	if card != nil {
		fingerprint = utils.HashSavedCardFingerprint(gateway.Container.Settings.SavedCardFingerprintKey, card.Signature, card.Brand, card.Last4, card.ExpiryMonth, card.ExpiryYear)
		update.SetCardBrand(truncate(card.Brand, 30)).SetCardLast4(truncate(card.Last4, 4)).SetCardExpiryMonth(card.ExpiryMonth).SetCardExpiryYear(card.ExpiryYear).SetCardFingerprintHash(fingerprint)
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	reference := "card-refund-" + strings.TrimPrefix(payment.Reference, "card-")
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "cardVerification.refundRequested", ExternalReference: payment.Reference, Description: "Card verification charge returned",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(payment.Currency), Direction: ledgermodels.Debit, AmountMinor: payment.AmountMinor},
			{Account: ledgermodels.RefundsPayableAccount(payment.Provider, payment.Currency), Direction: ledgermodels.Credit, AmountMinor: payment.AmountMinor},
		},
	}); err != nil {
		return err
	}
	if _, err := gateway.RequestRefundInTransaction(ctx, transaction, models.RefundRequest{
		PaymentIntentId: payment.IntentId, AmountMinor: payment.AmountMinor, Currency: payment.Currency, Reference: reference, Reason: "card verification",
	}); err != nil {
		return err
	}
	label, authorizationId, expiryMonth, expiryYear := "", "", 0, 0
	if setup.Purpose == "trial" || setup.Purpose == "device" {
		if authorizationId, err = gateway.StoreBillingAuthorizationInTransaction(ctx, transaction, payment.OwnerUserId, payment.Provider, payment.ProviderCustomerId, card); err != nil {
			return err
		}
	}
	if card != nil {
		label, expiryMonth, expiryYear = SavedCardLabel(card.Brand, card.Last4), card.ExpiryMonth, card.ExpiryYear
	}
	if err := gateway.notifySavedCardObservers(ctx, transaction, models.SavedCardFingerprint{
		OwnerUserId: payment.OwnerUserId, FingerprintHash: fingerprint, CardLabel: label, SavedAt: now, Purpose: setup.Purpose, SubjectId: setup.SubjectID,
		ProviderCustomerId: payment.ProviderCustomerId, SetupReference: setup.Reference, BillingAuthorizationId: authorizationId,
		CardExpiryMonth: expiryMonth, CardExpiryYear: expiryYear,
	}); err != nil {
		return err
	}
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "cardVerification.refunded", setup.ID.String(), now, map[string]any{
		"accountId": payment.OwnerUserId, "amount": map[string]any{"amountMinor": payment.AmountMinor, "currency": payment.Currency},
		"cardLabel": label, "reference": payment.Reference, "reason": "card verification",
	})
}

func (gateway *PaymentGateway) CompleteSavedCardSetup(ctx context.Context, userId, reference string) (DeviceSavedCard, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	setup, err := client.SavedCardSetup.Query().Where(savedcardsetup.Reference(reference), savedcardsetup.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return DeviceSavedCard{}, ErrSavedCardSetupNotFound
	}
	if err != nil {
		return DeviceSavedCard{}, err
	}
	if setup.Status == savedcardsetup.StatusPending {
		if _, err := gateway.VerifyAndSettlePaymentIntentByReference(ctx, reference); err != nil {
			return DeviceSavedCard{}, err
		}
		if setup, err = client.SavedCardSetup.Get(ctx, setup.ID); err != nil || setup.Status == savedcardsetup.StatusPending {
			return DeviceSavedCard{}, errors.Join(err, ErrSavedCardNotReady)
		}
	}
	if setup.CardFingerprintHash == "" {
		return DeviceSavedCard{}, ErrSavedCardHandoffGone
	}
	authorization, err := client.BillingAuthorization.Query().Where(billingauthorization.UserID(userId), billingauthorization.CardFingerprintHash(setup.CardFingerprintHash),
		billingauthorization.RevokedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return DeviceSavedCard{}, ErrSavedCardHandoffGone
	}
	if err != nil {
		return DeviceSavedCard{}, err
	}
	if setup.Status != savedcardsetup.StatusDelivered {
		if err := setup.Update().SetStatus(savedcardsetup.StatusDelivered).Exec(ctx); err != nil {
			return DeviceSavedCard{}, err
		}
	}
	return DeviceSavedCard{SavedCardId: authorization.ID.String(), Brand: authorization.CardBrand, Last4: authorization.CardLast4, ExpiryMonth: authorization.CardExpiryMonth, ExpiryYear: authorization.CardExpiryYear}, nil
}

func (gateway *PaymentGateway) recordProviderCustomerInTransaction(ctx context.Context, client *ent.Client, userId, provider, customerId string) error {
	if customerId == "" {
		return nil
	}
	err := client.ProviderCustomer.Create().SetUserID(userId).SetProvider(provider).SetProviderCustomerID(customerId).SetCreatedAt(gateway.Container.Now()).
		OnConflictColumns(providercustomer.FieldUserID, providercustomer.FieldProvider).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}

func (gateway *PaymentGateway) FindProviderCustomerId(ctx context.Context, userId string) (string, error) {
	row, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderCustomer.Query().
		Where(providercustomer.UserID(userId), providercustomer.Provider(gateway.Container.Settings.DefaultProvider)).Only(ctx)
	if ent.IsNotFound(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return row.ProviderCustomerID, nil
}

func SavedCardLabel(brand, last4 string) string {
	brand = strings.TrimSpace(brand)
	if brand == "" {
		brand = "Card"
	}
	return strings.ToUpper(brand[:1]) + brand[1:] + " •••• " + last4
}
