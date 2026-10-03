package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var ErrAlreadyPaid = httpserver.NewApiError(http.StatusConflict, "ALREADY_PAID", "This has already been paid.")

func (gateway *PaymentGateway) CreatePaymentIntentAndInitializeChargeInTransaction(ctx context.Context, transaction *sql.Tx, request models.CreatePaymentIntentRequest) (models.PaymentIntentView, error) {
	provider, err := gateway.Container.Provider(request.Provider)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if !provider.SupportsCurrency(request.Currency) {
		return models.PaymentIntentView{}, ErrCurrencyNotSupported
	}
	prefix, known := constants.ReferencePrefixByPurpose[request.Purpose]
	if !known || request.AmountMinor <= 0 {
		return models.PaymentIntentView{}, fmt.Errorf("invalid payment intent request for purpose %q", request.Purpose)
	}
	client := gateway.Container.Client(transaction)
	alreadyPaid, err := client.PaymentIntent.Query().Where(
		paymentintent.PurposeEQ(paymentintent.Purpose(request.Purpose)), paymentintent.SubjectID(request.SubjectId), paymentintent.StatusEQ(paymentintent.StatusSucceeded),
	).Exist(ctx)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if alreadyPaid {
		return models.PaymentIntentView{}, ErrAlreadyPaid
	}
	if err := client.PaymentIntent.Update().Where(
		paymentintent.PurposeEQ(paymentintent.Purpose(request.Purpose)), paymentintent.SubjectID(request.SubjectId), paymentintent.StatusEQ(paymentintent.StatusPending),
	).SetStatus(paymentintent.StatusCancelled).SetFailureReason("supersededByNewAttempt").AddVersion(1).Exec(ctx); err != nil {
		return models.PaymentIntentView{}, err
	}
	reference := prefix + strings.ReplaceAll(uuid.NewString(), "-", "")
	callbackUrl := gateway.buildCallbackUrl(request.ReturnTo, reference)
	metadata, _ := json.Marshal(request.Metadata)
	intent, err := client.PaymentIntent.Create().
		SetReference(reference).SetPurpose(paymentintent.Purpose(request.Purpose)).SetOwnerUserID(request.OwnerUserId).
		SetSubjectID(request.SubjectId).SetProvider(request.Provider).SetAmountMinor(request.AmountMinor).SetCurrency(request.Currency).
		SetMetadata(metadata).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return models.PaymentIntentView{}, fmt.Errorf("insert payment intent: %w", err)
	}
	chargeMetadata := map[string]string{"purpose": request.Purpose, "paymentIntentId": intent.ID.String(), "subjectId": request.SubjectId}
	session, err := provider.InitializeCharge(ctx, interfaces.ChargeRequest{
		Reference: reference, AmountMinor: request.AmountMinor, Currency: request.Currency,
		Email: gateway.customerEmail(request), CallbackUrl: callbackUrl, Metadata: chargeMetadata,
	})
	if err != nil {
		return models.PaymentIntentView{}, convertProviderError(err)
	}
	intent, err = intent.Update().SetAuthorizationURL(session.AuthorizationUrl).Save(ctx)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	view := ConvertPaymentIntentToView(intent)
	view.CallbackUrl = callbackUrl
	view.AccessCode = session.AccessCode
	return view, nil
}

func (gateway *PaymentGateway) buildCallbackUrl(returnTo, reference string) string {
	allowed := gateway.Container.Settings.AllowedReturnUrls
	base := "zudomart://payments/return"
	if len(allowed) > 0 {
		base = allowed[0]
	}
	if returnTo != "" && slices.Contains(allowed, returnTo) {
		base = returnTo
	}
	separator := "?"
	if strings.Contains(base, "?") {
		separator = "&"
	}
	return base + separator + "reference=" + url.QueryEscape(reference)
}

func (gateway *PaymentGateway) IsAllowedReturnUrl(returnTo string) bool {
	return returnTo == "" || slices.Contains(gateway.Container.Settings.AllowedReturnUrls, returnTo)
}

func (gateway *PaymentGateway) customerEmail(request models.CreatePaymentIntentRequest) string {
	if request.Email != "" {
		return request.Email
	}
	return "user-" + request.OwnerUserId + "@" + gateway.Container.Settings.CustomerEmailDomain
}

func ConvertPaymentIntentToView(intent *ent.PaymentIntent) models.PaymentIntentView {
	view := models.PaymentIntentView{
		Id: intent.ID, Reference: intent.Reference, Purpose: string(intent.Purpose), SubjectId: intent.SubjectID, Provider: intent.Provider,
		Amount:         models.MoneyView{AmountMinor: intent.AmountMinor, Currency: intent.Currency},
		Status:         string(intent.Status),
		RefundedAmount: models.MoneyView{AmountMinor: intent.RefundedMinor, Currency: intent.Currency},
		PaidAt:         intent.PaidAt, CreatedAt: intent.CreatedAt,
	}
	if intent.Status == paymentintent.StatusPending && intent.AuthorizationURL != "" {
		authorizationUrl := intent.AuthorizationURL
		view.AuthorizationUrl = &authorizationUrl
	}
	return view
}

func convertProviderError(err error) error {
	switch {
	case errors.Is(err, interfaces.ErrCurrencyNotSupported):
		return ErrCurrencyNotSupported
	case errors.Is(err, interfaces.ErrProviderUnavailable), errors.Is(err, interfaces.ErrProviderNotConfigured):
		return fmt.Errorf("%w: %v", ErrProviderUnavailable, err)
	}
	return err
}
