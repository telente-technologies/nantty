package services

import (
	"context"
	"log/slog"
	"time"

	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
)

func (billing Billing) RepriceLapsedBundles(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	now := billing.Container.Now().UTC()
	rows, err := client.Subscription.Query().Where(subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...),
		subscription.ChannelIn(subscription.ChannelWebCheckout, subscription.ChannelWebCheckout), subscription.ProviderPlanCodeNEQ(""), subscription.BundleLapsesAtLTE(now.Add(24*time.Hour))).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	repriced := 0
	for _, row := range rows {
		fullPlan, err := billing.ensureProviderPlan(ctx, row.PlanCode, row.Interval.String(), row.ListAmountMinor, row.Currency)
		if err != nil || row.ProviderCustomerID == "" || row.BundleLapsesAt == nil {
			continue
		}
		if row.BillingReference != "" {
			if err := billing.Container.Payments.CancelBillingSubscription(ctx, row.BillingReference); err != nil {
				billing.Container.Resources.Logger.WarnContext(ctx, "could not stop the discounted renewal", slog.String("subscriptionId", row.ID.String()), slog.Any("error", err))
				continue
			}
		}
		reference, err := billing.Container.Payments.StartTrialBillingSubscription(ctx, paymentservices.TrialBillingRequest{
			OwnerUserId: row.OwnerUserID, PlanCode: row.PlanCode, ProviderPlanId: fullPlan, ProviderCustomerId: row.ProviderCustomerID, TrialEndsAt: *row.BundleLapsesAt,
			Metadata: map[string]string{"subscriptionId": row.ID.String(), "repricing": "bundleLapsed"},
		})
		if err != nil {
			continue
		}
		if err := client.Subscription.UpdateOneID(row.ID).SetDiscountKind(subscription.DiscountKindNone).SetDiscountBps(0).SetAmountMinor(row.ListAmountMinor).
			SetProviderPlanCode(fullPlan).SetBillingReference(reference).ClearBundleLapsesAt().Exec(ctx); err == nil {
			repriced++
		}
	}
	return repriced
}
