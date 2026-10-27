package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/boosts/dtos"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

const (
	PaymentCard      = "card"
	PaymentAdBalance = "ad_balance"
	PaymentEarnings  = "balance"
	PaymentFree      = "free"
)

func paymentOption(method string, reasonCode, reason string) dtos.PaymentOption {
	if reasonCode == "" {
		return dtos.PaymentOption{Method: method, Available: true}
	}
	return dtos.PaymentOption{Method: method, ReasonCode: &reasonCode, Reason: &reason}
}

func ReadAdBalanceSummary(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency string) (dtos.AdBalanceSummary, error) {
	zero := types.Money{AmountMinor: 0, Currency: currency}
	summary := dtos.AdBalanceSummary{Balance: zero, Credit: zero, Committed: zero, Spendable: zero}
	account, err := FindPersonalBoostAccount(ctx, deployed.Client, userId, currency)
	if err != nil || account == nil {
		return summary, err
	}
	position, err := adsservices.ReadAdFundsPosition(ctx, deployed.Client, account, deployed.Now())
	if err != nil {
		return summary, err
	}
	accountId := account.ID.String()
	summary.AccountId = &accountId
	summary.Balance.AmountMinor, summary.Credit.AmountMinor = position.BalanceMinor, position.CreditMinor
	summary.Committed.AmountMinor, summary.Spendable.AmountMinor = position.CommittedMinor, position.SpendableMinor
	return summary, nil
}

func earningsPaymentOption(ctx context.Context, deployed *container.Container, userId uuid.UUID, platform string) dtos.PaymentOption {
	if IsNativeClient(platform) {
		return paymentOption(PaymentEarnings, "NOT_AVAILABLE_IN_APP", "Pay from your earnings on nantty.com.")
	}
	status, err := deployed.Verification.ReadVerificationLevel(ctx, userId.String())
	if err != nil {
		return paymentOption(PaymentEarnings, "VERIFICATION_UNAVAILABLE", "We couldn't check your verification. Try again in a moment.")
	}
	if status.Level < adsservices.PayoutVerifiedLevel {
		return paymentOption(PaymentEarnings, "VERIFICATION_REQUIRED", "Verify payouts to pay from your earnings.")
	}
	return paymentOption(PaymentEarnings, "", "")
}

func adBalancePaymentOption(summary dtos.AdBalanceSummary) dtos.PaymentOption {
	if summary.Spendable.AmountMinor <= 0 {
		return paymentOption(PaymentAdBalance, "NO_AD_FUNDS", "You have no ad credit or balance to spend.")
	}
	return paymentOption(PaymentAdBalance, "", "")
}

func BuildCreatePaymentOptions(ctx context.Context, deployed *container.Container, userId uuid.UUID, platform string, freeBoost dtos.FreeBoost, summary dtos.AdBalanceSummary) []dtos.PaymentOption {
	options := []dtos.PaymentOption{paymentOption(PaymentCard, "", ""), adBalancePaymentOption(summary), earningsPaymentOption(ctx, deployed, userId, platform)}
	switch {
	case !freeBoost.Premium:
		options = append(options, paymentOption(PaymentFree, "PREMIUM_REQUIRED", "Free boosts come with Premium."))
	case !freeBoost.Eligible:
		options = append(options, paymentOption(PaymentFree, "FREE_BOOST_USED", "You've used this month's free boost."))
	default:
		options = append(options, paymentOption(PaymentFree, "", ""))
	}
	return options
}

func BuildBudgetChangePaymentOptions(summary dtos.AdBalanceSummary) []dtos.PaymentOption {
	return []dtos.PaymentOption{
		paymentOption(PaymentCard, "", ""), adBalancePaymentOption(summary),
		paymentOption(PaymentEarnings, "NOT_FOR_BUDGET_CHANGES", "To use earnings, add them to your ad balance first, then pay from your ad balance."),
		paymentOption(PaymentFree, "NOT_FOR_BUDGET_CHANGES", "The free boost can't be used to add budget."),
	}
}
