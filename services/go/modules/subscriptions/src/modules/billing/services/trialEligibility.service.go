package services

import (
	"context"
	"strings"

	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/trialclaim"
	"zudomart/modules/subscriptions/src/models"
)

func (billing Billing) TrialIneligibility(ctx context.Context, client *ent.Client, request CheckoutRequest, planAllowsTrial bool) ([]models.IneligibleReason, error) {
	trialRules, _ := billing.rules(ctx)
	account, _, err := billing.Container.Identity.ReadAccountSignals(ctx, request.UserId)
	if err != nil {
		return nil, err
	}
	personUsed, err := client.TrialClaim.Query().Where(trialclaim.KindEQ(trialclaim.KindPerson), trialclaim.FingerprintHash(billing.fingerprint("person:"+request.UserId))).Exist(ctx)
	if err != nil {
		return nil, err
	}
	deviceUsed := false
	if request.DeviceId != "" {
		if deviceUsed, err = client.TrialClaim.Query().Where(trialclaim.KindEQ(trialclaim.KindDevice), trialclaim.FingerprintHash(billing.fingerprint("device:"+request.DeviceId))).Exist(ctx); err != nil {
			return nil, err
		}
	}
	emailUsed := false
	if strings.TrimSpace(account.Email) != "" {
		if emailUsed, err = client.TrialClaim.Query().Where(trialclaim.KindEQ(trialclaim.KindEmail), trialclaim.FingerprintHash(billing.emailFingerprint(account.Email))).Exist(ctx); err != nil {
			return nil, err
		}
	}
	subscribed, err := client.Subscription.Query().Where(subscription.ProfileID(request.ProfileId), subscription.PlanCode(request.PlanCode), subscription.StatusIn(liveStatuses()...)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	signals := models.TrialSignals{
		AccountCreatedAt: account.CreatedAt, EmailVerified: account.EmailVerified, PersonUsedTrial: personUsed, DeviceUsedTrial: deviceUsed, EmailUsedTrial: emailUsed,
		CompletedOrders: trialRules.MinimumCompletedOrders, AlreadySubscribed: subscribed, PlanAllowsTrial: planAllowsTrial,
	}
	if counter := billing.Container.TrialSignals; counter != nil {
		if completed, known := counter.CompletedOrders(ctx, request.ProfileId); known {
			signals.CompletedOrders = completed
		}
		signals.RiskScore = counter.RiskScore(ctx, request.UserId)
	}
	return models.EvaluateTrialEligibility(trialRules, signals, billing.Container.Now()), nil
}
