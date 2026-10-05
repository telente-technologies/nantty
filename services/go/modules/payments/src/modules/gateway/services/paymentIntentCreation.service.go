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
	"time"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/payments/src/repositories"
	"zudomart/platform/httpserver"
)

var ErrAlreadyPaid = httpserver.NewApiError(http.StatusConflict, "ALREADY_PAID", "This has already been paid.")

func (gateway *PaymentGateway) CreatePendingPaymentIntentInTransaction(ctx context.Context, transaction *sql.Tx, request models.CreatePaymentIntentRequest) (models.PaymentIntentView, error) {
	if request.Provider == "" {
		request.Provider = gateway.Container.Settings.DefaultProvider
	}
	provider, err := gateway.Container.Provider(request.Provider)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if !provider.SupportsCurrency(request.Currency) {
		return models.PaymentIntentView{}, ErrCurrencyNotSupported
	}
	prefix, known := constants.ReferencePrefixByPurpose[request.Purpose]
	if !known || request.AmountMinor <= 0 || request.PlatformFeeMinor < 0 || request.PlatformFeeMinor >= request.AmountMinor {
		return models.PaymentIntentView{}, fmt.Errorf("invalid payment intent request for purpose %q", request.Purpose)
	}
	if _, err := gateway.requireVerifiedContact(ctx, request.OwnerUserId); err != nil {
		return models.PaymentIntentView{}, err
	}
	connectedAccountId, err := gateway.connectedAccountReadyForCharges(ctx, transaction, request)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if err := lockPaymentSubject(ctx, transaction, request.Purpose, request.SubjectId); err != nil {
		return models.PaymentIntentView{}, err
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
	if request.Reference != "" && strings.HasPrefix(request.Reference, prefix) {
		reference = request.Reference
	}
	callbackUrl := gateway.buildCallbackUrl(request.ReturnTo, reference)
	metadata := map[string]string{}
	for key, value := range request.Metadata {
		metadata[key] = value
	}
	metadata[callbackUrlMetadataKey] = callbackUrl
	encodedMetadata, _ := json.Marshal(metadata)
	intent, err := client.PaymentIntent.Create().
		SetReference(reference).SetPurpose(paymentintent.Purpose(request.Purpose)).SetOwnerUserID(request.OwnerUserId).
		SetSubjectID(request.SubjectId).SetProvider(request.Provider).SetAmountMinor(request.AmountMinor).SetCurrency(request.Currency).
		SetConnectedAccountID(connectedAccountId).SetBeneficiaryUserID(request.BeneficiaryUserId).SetPlatformFeeMinor(request.PlatformFeeMinor).
		SetMetadata(encodedMetadata).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return models.PaymentIntentView{}, fmt.Errorf("insert payment intent: %w", err)
	}
	if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentIntent.created", intent.ID.String(), gateway.Container.Now().UTC(), paymentEventData(intent)); err != nil {
		return models.PaymentIntentView{}, err
	}
	view := ConvertPaymentIntentToView(intent)
	view.CallbackUrl = callbackUrl
	return view, nil
}

const callbackUrlMetadataKey = "zudomartCallbackUrl"

func (gateway *PaymentGateway) OpenProviderCheckoutForIntent(ctx context.Context, intentId uuid.UUID) (models.PaymentIntentView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	intent, err := client.PaymentIntent.Get(ctx, intentId)
	if ent.IsNotFound(err) {
		return models.PaymentIntentView{}, ErrPaymentNotFound
	}
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	metadata := map[string]string{}
	_ = json.Unmarshal(intent.Metadata, &metadata)
	callbackUrl := metadata[callbackUrlMetadataKey]
	delete(metadata, callbackUrlMetadataKey)
	if intent.Status != paymentintent.StatusPending || intent.AuthorizationURL != "" {
		view := ConvertPaymentIntentToView(intent)
		view.CallbackUrl = callbackUrl
		return view, nil
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	contact, err := gateway.requireVerifiedContact(ctx, intent.OwnerUserID)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	metadata["purpose"], metadata["paymentIntentId"], metadata["subjectId"] = string(intent.Purpose), intent.ID.String(), intent.SubjectID
	splitShares := SplitSharesForGroups(models.DecodeCheckoutGroups(metadata))
	delete(metadata, models.CheckoutGroupsMetadataKey)
	session, err := provider.InitializeCharge(ctx, interfaces.ChargeRequest{
		SplitShares: splitShares,
		Reference:   intent.Reference, AmountMinor: intent.AmountMinor, Currency: intent.Currency,
		SettlementAccount: intent.ConnectedAccountID, SubaccountBearsFee: gateway.Container.Settings.Paystack.SubaccountBearsFee,
		CustomerEmail: contact.Email, CustomerLabel: customerDisplayName(contact), SuccessUrl: callbackUrl, Channels: gateway.Container.Settings.Paystack.Channels,
		PlanCode: metadata["paystackPlanCode"], ExpiresInMinutes: gateway.Container.Settings.CheckoutExpiryMinutes, Metadata: metadata,
	})
	if err != nil {
		return models.PaymentIntentView{}, convertProviderError(err)
	}
	if err := client.PaymentIntent.Update().Where(paymentintent.ID(intent.ID), paymentintent.StatusEQ(paymentintent.StatusPending), paymentintent.AuthorizationURL("")).
		SetAuthorizationURL(session.CheckoutUrl).SetProviderCheckoutID(session.ProviderCheckoutId).Exec(ctx); err != nil {
		return models.PaymentIntentView{}, err
	}
	if intent, err = client.PaymentIntent.Get(ctx, intent.ID); err != nil {
		return models.PaymentIntentView{}, err
	}
	view := ConvertPaymentIntentToView(intent)
	view.CallbackUrl = callbackUrl
	return view, nil
}

func (gateway *PaymentGateway) CancelPendingIntentsThatNeverOpenedACheckout(ctx context.Context, olderThan time.Duration) (int, error) {
	return gateway.Container.Client(gateway.Container.Resources.Database).PaymentIntent.Update().
		Where(paymentintent.StatusEQ(paymentintent.StatusPending), paymentintent.ProviderCheckoutID(""), paymentintent.CreatedAtLT(gateway.Container.Now().Add(-olderThan))).
		SetStatus(paymentintent.StatusCancelled).SetFailureReason("checkoutNeverOpened").AddVersion(1).Save(ctx)
}

func (gateway *PaymentGateway) connectedAccountReadyForCharges(ctx context.Context, transaction *sql.Tx, request models.CreatePaymentIntentRequest) (string, error) {
	if !request.SettleToSellerSubaccount {
		return "", nil
	}
	if request.BeneficiaryUserId == "" || request.PlatformFeeMinor != 0 {
		return "", fmt.Errorf("a direct payment needs a seller and carries no platform fee")
	}
	account, err := gateway.FindConnectedAccountForUser(ctx, transaction, request.BeneficiaryUserId)
	if errors.Is(err, ErrConnectedAccountMissing) {
		return "", ErrSellerNotReadyForPayments
	}
	if err != nil {
		return "", err
	}
	if !ConnectedAccountCanAcceptPayments(account) {
		return "", ErrSellerNotReadyForPayments
	}
	return account.SettlementSubaccountCode, nil
}

func (gateway *PaymentGateway) requireVerifiedContact(ctx context.Context, userId string) (repositories.VerifiedAccountContact, error) {
	contact, found, err := gateway.Container.Accounts.FindAccountContact(ctx, userId)
	if err != nil {
		return repositories.VerifiedAccountContact{}, err
	}
	if !found || !contact.EmailVerified || contact.Email == "" {
		return repositories.VerifiedAccountContact{}, ErrVerifyEmailRequired
	}
	return contact, nil
}

func customerDisplayName(contact repositories.VerifiedAccountContact) string {
	if strings.TrimSpace(contact.Name) != "" {
		return strings.TrimSpace(contact.Name)
	}
	local, _, _ := strings.Cut(contact.Email, "@")
	return local
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

func ConvertPaymentIntentToView(intent *ent.PaymentIntent) models.PaymentIntentView {
	view := models.PaymentIntentView{
		Id: intent.ID, Reference: intent.Reference, Purpose: string(intent.Purpose), SubjectId: intent.SubjectID, Provider: intent.Provider,
		Amount:         models.MoneyView{AmountMinor: intent.AmountMinor, Currency: intent.Currency},
		Status:         string(intent.Status),
		RefundedAmount: models.MoneyView{AmountMinor: intent.RefundedMinor, Currency: intent.Currency},
		PaidAt:         intent.PaidAt, CreatedAt: intent.CreatedAt,
	}
	if intent.Status == paymentintent.StatusPending && intent.AuthorizationURL != "" {
		checkoutUrl := intent.AuthorizationURL
		view.CheckoutUrl = &checkoutUrl
		view.AuthorizationUrl = &checkoutUrl
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

func lockPaymentSubject(ctx context.Context, transaction *sql.Tx, purpose, subjectId string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "pay-subject:"+purpose+":"+subjectId)
	return err
}
