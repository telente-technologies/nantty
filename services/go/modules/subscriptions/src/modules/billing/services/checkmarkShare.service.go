package services

import (
	"context"
	"log/slog"

	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/platform/regionpricing"
)

// KeepsPlanOnRejection is true for plans that sell more than the checkmark (seller plans and Premium): a rejected
// verification withholds the checkmark and refunds its share, and the plan keeps running.
func KeepsPlanOnRejection(planCode string) bool {
	definition, known := constants.Plans[planCode]
	return known && (definition.SellerPlan != "" || planCode == constants.PlanPremium)
}

func CheckmarkOfPlan(planCode string) string {
	return constants.Plans[planCode].Checkmark
}

// ApplyShareToPath turns a share refund of nothing into "nothing charged", so no refund call is made for zero.
func ApplyShareToPath(path VerificationRefundPath, shareMinor int64) VerificationRefundPath {
	switch path {
	case RefundPathCardShare, RefundPathGoogleShare, RefundPathAppleManual:
		if shareMinor <= 0 {
			return RefundPathNothingCharged
		}
	}
	return path
}

func priceChannelOf(channel subscription.Channel) string {
	switch channel {
	case subscription.ChannelGooglePlay:
		return "android"
	case subscription.ChannelAppleIap:
		return "ios"
	}
	return "web"
}

// checkmarkShareFor is the standalone checkmark price from the price book (research defaults when the book has no
// row), capped at what this subscription pays per period. Zero means the price is unknown, so nothing is refunded
// and an alert is logged for a person to settle.
func (billing Billing) checkmarkShareFor(ctx context.Context, row *ent.Subscription) int64 {
	checkmark := CheckmarkOfPlan(row.PlanCode)
	channel, interval := priceChannelOf(row.Channel), row.Interval.String()
	standalone := regionpricing.DefaultCheckmarkStandalonePrice(checkmark, row.Currency, channel, interval)
	if region, found := regionpricing.RegionForCurrency(row.Currency); found {
		if booked, found := billing.FindPriceRow(ctx, regionpricing.CheckmarkStandalonePlan(checkmark), region.Code); found && booked.Active {
			if amount := booked.regional().AmountFor(channel, interval); amount > 0 {
				standalone = amount
			} else if amount := booked.regional().AmountFor("web", interval); amount > 0 {
				standalone = amount
			}
		}
	}
	share := regionpricing.CheckmarkShareMinor(standalone, row.AmountMinor)
	if share == 0 {
		billing.Container.Resources.Logger.ErrorContext(ctx, "ALERT no checkmark share price; settle the rejected verification refund by hand", slog.String("subscriptionId", row.ID.String()), slog.String("currency", row.Currency))
	}
	return share
}

func (billing Billing) refundCheckmarkShareToCard(ctx context.Context, row *ent.Subscription, share int64, request VerificationRefundRequest) (string, error) {
	_, err := billing.Container.Payments.RefundBillingSubscriptionPartially(ctx, paymentservices.PartialBillingRefund{
		BillingReference: row.BillingReference, Reference: "verification-share:" + request.CaseId, AmountMinor: share, Currency: row.Currency,
		Reason: "Checkmark verification rejected: " + request.Reason,
	})
	if err == nil {
		return "succeeded", nil
	}
	if paymentservices.IsDefinitiveProviderRejection(err) {
		billing.Container.Resources.Logger.ErrorContext(ctx, "ALERT checkmark share refund rejected by the provider; refund it by hand", "subscriptionId", row.ID.String(), "error", err.Error())
		return "failed", nil
	}
	return "", err
}
