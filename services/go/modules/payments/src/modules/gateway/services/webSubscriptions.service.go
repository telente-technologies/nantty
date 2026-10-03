package services

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/billingsubscription"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/httpserver"
)

var (
	ErrWebBillingOnly      = httpserver.NewApiError(http.StatusUnprocessableEntity, "WEB_BILLING_ONLY", "Subscriptions and trials can only be started on the web.")
	ErrPlanNotAvailable    = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAN_NOT_AVAILABLE", "This plan is not available yet.")
	downgradingStatuses    = map[string]bool{"canceled": true, "unpaid": true}
	subscriptionEventTypes = map[string]string{"invoice.payment_failed": "past_due", "invoice.paid": "active"}
)

type WebSubscriptionCheckout struct {
	Reference   string `json:"reference"`
	PlanCode    string `json:"planCode"`
	CheckoutUrl string `json:"checkoutUrl"`
}

func (gateway *PaymentGateway) StartWebSubscriptionCheckout(ctx context.Context, userId, planCode, returnTo, clientPlatform string) (WebSubscriptionCheckout, error) {
	if clientPlatform == "ios" || clientPlatform == "android" {
		return WebSubscriptionCheckout{}, ErrWebBillingOnly
	}
	productId, found := gateway.Container.Settings.WebSubscriptionPlanProducts[planCode]
	if !found {
		return WebSubscriptionCheckout{}, ErrPlanNotAvailable
	}
	contact, err := gateway.requireVerifiedContact(ctx, userId)
	if err != nil {
		return WebSubscriptionCheckout{}, err
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return WebSubscriptionCheckout{}, err
	}
	reference := "zmsub_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	row, err := client.BillingSubscription.Create().SetOwnerUserID(userId).SetPlanCode(planCode).SetProvider(provider.Name()).
		SetReference(reference).SetProviderProductID(productId).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return WebSubscriptionCheckout{}, err
	}
	callbackUrl := gateway.buildCallbackUrl(returnTo, reference)
	session, err := provider.CreateSubscriptionCheckout(ctx, interfaces.SubscriptionCheckoutRequest{
		ProviderProductId: productId, Reference: reference, CustomerEmail: contact.Email, CustomerName: customerDisplayName(contact),
		SuccessUrl: callbackUrl, CancelUrl: callbackUrl + "&status=cancelled", IdempotencyKey: "subscription-checkout:" + reference,
		Metadata: map[string]string{"billingSubscriptionReference": reference, "planCode": planCode, "ownerUserId": userId},
	})
	if err != nil {
		return WebSubscriptionCheckout{}, convertProviderError(err)
	}
	if err := row.Update().SetProviderCheckoutID(session.ProviderCheckoutId).Exec(ctx); err != nil {
		return WebSubscriptionCheckout{}, err
	}
	return WebSubscriptionCheckout{Reference: reference, PlanCode: planCode, CheckoutUrl: session.CheckoutUrl}, nil
}

func (gateway *PaymentGateway) HandleSubscriptionNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	update := notification.Subscription
	if update == nil {
		return nil
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		row, err := findBillingSubscription(ctx, client, update)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		status := update.Status
		if mapped, isInvoice := subscriptionEventTypes[notification.EventType]; isInvoice {
			status = mapped
		}
		if notification.EventType == "customer.subscription.deleted" {
			status = "canceled"
		}
		now := gateway.Container.Now().UTC()
		change := row.Update().SetStatus(truncate(status, 40))
		if update.ProviderSubscriptionId != "" && row.ProviderSubscriptionID == "" {
			change.SetProviderSubscriptionID(update.ProviderSubscriptionId)
		}
		if update.TrialEndsAt != nil {
			change.SetTrialEndsAt(*update.TrialEndsAt)
		}
		if update.CurrentPeriodEndsAt != nil {
			change.SetCurrentPeriodEndsAt(*update.CurrentPeriodEndsAt)
		}
		eventType := "billingSubscription." + status
		if downgradingStatuses[status] && row.DowngradedAt == nil {
			change.SetDowngradedAt(now)
			eventType = "billingSubscription.downgraded"
		}
		if err := change.Exec(ctx); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, row.ID.String(), now, map[string]any{
			"billingSubscriptionId": row.ID.String(), "ownerUserId": row.OwnerUserID, "planCode": row.PlanCode, "status": status,
			"trialEndsAt": update.TrialEndsAt, "currentPeriodEndsAt": update.CurrentPeriodEndsAt,
		})
	})
}

func findBillingSubscription(ctx context.Context, client *ent.Client, update *interfaces.ProviderSubscriptionUpdate) (*ent.BillingSubscription, error) {
	if update.ProviderSubscriptionId != "" {
		row, err := client.BillingSubscription.Query().Where(billingsubscription.ProviderSubscriptionID(update.ProviderSubscriptionId)).ForUpdate().Only(ctx)
		if !ent.IsNotFound(err) {
			return row, err
		}
	}
	reference := update.Metadata["billingSubscriptionReference"]
	if reference == "" {
		return nil, &ent.NotFoundError{}
	}
	return client.BillingSubscription.Query().Where(billingsubscription.Reference(reference)).ForUpdate().Only(ctx)
}
