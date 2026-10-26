package services

import (
	"context"
	"log/slog"
	"strings"

	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/platform/regionpricing"
)

func KeepsPlanOnRejection(planCode string) bool {
	definition, known := constants.Plans[planCode]
	return known && (definition.SellerPlan != "" || planCode == constants.PlanPremium)
}

func CheckmarkOfPlan(planCode string) string {
	return constants.Plans[planCode].Checkmark
}

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

func (billing Billing) standaloneCheckmarkPriceMinor(ctx context.Context, checkmark, currency, channel, interval string) int64 {
	standalone := regionpricing.DefaultCheckmarkStandalonePrice(checkmark, currency, channel, interval)
	if region, found := regionpricing.RegionForCurrency(currency); found {
		if booked, found := billing.FindPriceRow(ctx, regionpricing.CheckmarkStandalonePlan(checkmark), region.Code); found && booked.Active && booked.Currency == currency {
			if amount := booked.regional().AmountFor(channel, interval); amount > 0 {
				standalone = amount
			} else if amount := booked.regional().AmountFor("web", interval); amount > 0 {
				standalone = amount
			}
		}
	}
	return standalone
}

func (billing Billing) checkmarkShareFor(ctx context.Context, row *ent.Subscription) int64 {
	if IsEngineManaged(row) && !row.CheckmarkIncluded {
		return 0
	}
	standalone := billing.standaloneCheckmarkPriceMinor(ctx, CheckmarkOfPlan(row.PlanCode), row.Currency, priceChannelOf(row.Channel), row.Interval.String())
	share := regionpricing.CheckmarkShareMinor(standalone, row.AmountMinor)
	if share == 0 {
		billing.Container.Resources.Logger.ErrorContext(ctx, "ALERT no checkmark share price; settle the rejected verification refund by hand", slog.String("subscriptionId", row.ID.String()), slog.String("currency", row.Currency))
	}
	return share
}

func (billing Billing) refundCheckmarkShareToCard(ctx context.Context, row *ent.Subscription, share int64, request VerificationRefundRequest) (string, error) {
	if strings.HasPrefix(row.BillingReference, "ren-") {
		return billing.Container.Payments.RefundSubscriptionPayment(ctx, paymentservices.SubscriptionPaymentRefund{
			PaymentReference: row.BillingReference, Reference: "verification-share:" + request.CaseId, AmountMinor: share, Reason: "Checkmark verification rejected: " + request.Reason,
		})
	}
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
