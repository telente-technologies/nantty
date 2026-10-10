package models

import "time"

type TrialRules struct {
	TrialDays              int
	MinimumAccountAgeDays  int
	RequiresVerifiedEmail  bool
	OnePerPerson           bool
	OnePerCard             bool
	OnePerDevice           bool
	MaximumRiskScore       int
	MinimumCompletedOrders int
}

type TrialSignals struct {
	AccountCreatedAt  time.Time
	EmailVerified     bool
	PersonUsedTrial   bool
	DeviceUsedTrial   bool
	CardUsedTrial     bool
	EmailUsedTrial    bool
	RiskScore         *int
	CompletedOrders   int
	AlreadySubscribed bool
	PlanAllowsTrial   bool
}

type IneligibleReason struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func EvaluateTrialEligibility(rules TrialRules, signals TrialSignals, now time.Time) []IneligibleReason {
	reasons := []IneligibleReason{}
	add := func(code, message string) { reasons = append(reasons, IneligibleReason{Code: code, Message: message}) }
	if !signals.PlanAllowsTrial {
		add("PLAN_HAS_NO_TRIAL", "This plan doesn't come with a free trial.")
	}
	if signals.AlreadySubscribed {
		add("ALREADY_SUBSCRIBED", "This profile already has this plan.")
	}
	if now.Sub(signals.AccountCreatedAt) < time.Duration(rules.MinimumAccountAgeDays)*24*time.Hour {
		add("ACCOUNT_TOO_NEW", "Free trials open up once your account is a little older.")
	}
	if rules.RequiresVerifiedEmail && !signals.EmailVerified {
		add("EMAIL_NOT_VERIFIED", "Verify your email to start a free trial.")
	}
	if rules.OnePerPerson && (signals.PersonUsedTrial || signals.EmailUsedTrial) {
		add("TRIAL_ALREADY_USED", "You've already used your free trial.")
	}
	if rules.OnePerDevice && signals.DeviceUsedTrial {
		add("DEVICE_ALREADY_USED", "A free trial was already used on this device.")
	}
	if rules.OnePerCard && signals.CardUsedTrial {
		add("CARD_ALREADY_USED", "This card was already used for a free trial.")
	}
	if signals.RiskScore != nil && rules.MaximumRiskScore > 0 && *signals.RiskScore > rules.MaximumRiskScore {
		add("RISK_TOO_HIGH", "We can't offer a free trial on this account right now.")
	}
	if signals.CompletedOrders < rules.MinimumCompletedOrders {
		add("NOT_ENOUGH_COMPLETED_ORDERS", "Complete a few more orders to unlock a free trial.")
	}
	return reasons
}

func TrialDaysFor(trialLength string) int {
	if trialLength == "MONTH_1" {
		return 30
	}
	return 7
}
