package services

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/billingsubscription"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

var (
	ErrWebBillingOnly            = httpserver.NewApiError(http.StatusUnprocessableEntity, "WEB_BILLING_ONLY", "Subscriptions and trials can only be started on the web.")
	ErrPlanNotAvailable          = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAN_NOT_AVAILABLE", "This plan is not available yet.")
	providerSubscriptionStatuses = map[string]string{"active": "active", "non-renewing": "non_renewing", "attention": "past_due", "cancelled": "canceled", "complete": "canceled", "completed": "canceled"}
	downgradingStatuses          = map[string]bool{"canceled": true}
)

type WebSubscriptionCheckout struct {
	Reference   string `json:"reference"`
	PlanCode    string `json:"planCode"`
	CheckoutUrl string `json:"checkoutUrl"`
}

func (gateway *PaymentGateway) StartWebSubscriptionCheckout(ctx context.Context, userId, planCode, returnTo, clientPlatform string) (WebSubscriptionCheckout, error) {
	providerPlan, found := gateway.Container.Settings.WebSubscriptionPlanProducts[planCode]
	if !found {
		return WebSubscriptionCheckout{}, ErrPlanNotAvailable
	}
	started, err := gateway.StartSubscriptionCheckoutForProduct(ctx, models.SubscriptionCheckoutStart{
		OwnerUserId: userId, PlanCode: planCode, ProviderPlanId: providerPlan, AmountMinor: 100, Currency: "NGN", ReturnTo: returnTo, ClientPlatform: clientPlatform,
	})
	return WebSubscriptionCheckout{Reference: started.Reference, PlanCode: started.PlanCode, CheckoutUrl: started.CheckoutUrl}, err
}

func (gateway *PaymentGateway) StartSubscriptionCheckoutForProduct(ctx context.Context, start models.SubscriptionCheckoutStart) (models.StartedSubscriptionCheckout, error) {
	if start.ClientPlatform == "ios" || start.ClientPlatform == "android" {
		return models.StartedSubscriptionCheckout{}, ErrWebBillingOnly
	}
	contact, err := gateway.requireVerifiedContact(ctx, start.OwnerUserId)
	if err != nil {
		return models.StartedSubscriptionCheckout{}, err
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return models.StartedSubscriptionCheckout{}, err
	}
	reference := "sub-" + strings.ReplaceAll(uuid.NewString(), "-", "")
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	row, err := client.BillingSubscription.Create().SetOwnerUserID(start.OwnerUserId).SetPlanCode(start.PlanCode).SetProvider(provider.Name()).
		SetReference(reference).SetProviderProductID(start.ProviderPlanId).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return models.StartedSubscriptionCheckout{}, err
	}
	metadata := map[string]string{"billingSubscriptionReference": reference, "planCode": start.PlanCode, "ownerUserId": start.OwnerUserId}
	for key, value := range start.Metadata {
		metadata[key] = value
	}
	session, err := provider.InitializeCharge(ctx, interfaces.ChargeRequest{
		Reference: reference, AmountMinor: max(start.AmountMinor, 100), Currency: firstNonEmpty(start.Currency, "NGN"), CustomerEmail: contact.Email,
		CustomerLabel: customerDisplayName(contact), SuccessUrl: gateway.buildCallbackUrl(start.ReturnTo, reference), Channels: []string{"card"},
		PlanCode: start.ProviderPlanId, Metadata: metadata,
	})
	if err != nil {
		return models.StartedSubscriptionCheckout{}, convertProviderError(err)
	}
	if err := row.Update().SetProviderCheckoutID(session.ProviderCheckoutId).Exec(ctx); err != nil {
		return models.StartedSubscriptionCheckout{}, err
	}
	return models.StartedSubscriptionCheckout{Reference: reference, PlanCode: start.PlanCode, CheckoutUrl: session.CheckoutUrl}, nil
}

type TrialBillingRequest struct {
	OwnerUserId        string
	PlanCode           string
	ProviderPlanId     string
	ProviderCustomerId string
	TrialEndsAt        time.Time
	Metadata           map[string]string
}

func (gateway *PaymentGateway) StartTrialBillingSubscription(ctx context.Context, request TrialBillingRequest) (string, error) {
	provider, err := gateway.Container.DefaultSubscriptions()
	if err != nil {
		return "", err
	}
	subscription, err := provider.CreateSubscription(ctx, interfaces.SubscriptionRequest{ProviderCustomerId: request.ProviderCustomerId, PlanCode: request.ProviderPlanId, StartDate: &request.TrialEndsAt})
	if err != nil {
		return "", convertProviderError(err)
	}
	reference := "sub-" + strings.ReplaceAll(uuid.NewString(), "-", "")
	trialEnds := request.TrialEndsAt.UTC()
	return reference, databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		row, err := gateway.Container.Client(transaction).BillingSubscription.Create().SetOwnerUserID(request.OwnerUserId).SetPlanCode(request.PlanCode).SetProvider(gateway.Container.Settings.DefaultProvider).
			SetReference(reference).SetProviderProductID(request.ProviderPlanId).SetProviderSubscriptionID(subscription.SubscriptionCode).
			SetProviderCustomerID(request.ProviderCustomerId).SetEmailToken(subscription.EmailToken).SetStatus("trialing").SetTrialEndsAt(trialEnds).
			SetCurrentPeriodEndsAt(trialEnds).SetCreatedAt(gateway.Container.Now()).Save(ctx)
		if err != nil {
			return err
		}
		return gateway.notifyBillingObservers(ctx, transaction, models.BillingSubscriptionChange{
			BillingSubscriptionId: row.ID.String(), Reference: reference, ProviderSubscriptionId: subscription.SubscriptionCode, PlanCode: request.PlanCode,
			OwnerUserId: request.OwnerUserId, EventType: "trial.started", Status: "trialing", TrialEndsAt: &trialEnds, CurrentPeriodEndsAt: &trialEnds,
			OccurredAt: gateway.Container.Now().UTC(), Metadata: request.Metadata,
		})
	})
}

func (gateway *PaymentGateway) CancelBillingSubscription(ctx context.Context, reference string) error {
	row, err := gateway.Container.Client(gateway.Container.Resources.Database).BillingSubscription.Query().Where(billingsubscription.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return ErrPaymentNotFound
	}
	if err != nil || row.ProviderSubscriptionID == "" {
		return err
	}
	return gateway.DisableProviderSubscription(ctx, row.ProviderSubscriptionID, row.EmailToken)
}

func (gateway *PaymentGateway) HandleSubscriptionChargeNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	if !strings.HasPrefix(notification.Reference, "sub-") {
		return nil
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return err
	}
	verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: notification.Reference})
	if err != nil || verification.Outcome != interfaces.OutcomeSucceeded {
		return convertProviderError(err)
	}
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	row, err := client.BillingSubscription.Query().Where(billingsubscription.Reference(notification.Reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := gateway.recordProviderCustomerInTransaction(ctx, client, row.OwnerUserID, row.Provider, verification.ProviderCustomerId); err != nil {
		return err
	}
	return row.Update().SetProviderCustomerID(verification.ProviderCustomerId).Exec(ctx)
}
