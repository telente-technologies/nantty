package services

import (
	"context"
	"time"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/verificationeligibility"
	"zudomart/modules/users/src/integrations"
	checkmarkservices "zudomart/modules/users/src/modules/checkmarks/services"
	creatorservices "zudomart/modules/users/src/modules/creatorProgram/services"
	verificationevents "zudomart/modules/users/src/modules/identityVerification/events"
	"zudomart/platform/identityports"
)

const (
	TierBuyNow  = "buy_now"
	TierRequest = "request"
	TierBlocked = "blocked"
)

var ErrBlackUsesVetting = usersErrors.Conflict("BLACK_USES_VETTING", "Government profiles apply for the Black checkmark through official vetting.")

func ColorForVerification(profile *ent.Profile) (string, error) {
	color := checkmarkservices.ColorForProfileType(profile.ProfileType)
	if color == profilecheckmark.ColorBlack {
		return "", ErrBlackUsesVetting
	}
	return string(color), nil
}

func BuildEligibilitySignals(ctx context.Context, application *container.Container, profile *ent.Profile, account identityports.AccountSummary, color string) (integrations.EligibilitySignals, error) {
	signals, err := creatorservices.LoadProfileSignals(ctx, application, profile.ID)
	if err != nil {
		return integrations.EligibilitySignals{}, err
	}
	rules := checkmarkservices.LoadSuggestionRules(ctx)
	return integrations.EligibilitySignals{
		ProfileId: profile.ID.String(), Color: color, AccountAgeDays: max(int(application.Now().Sub(account.CreatedAt).Hours()/24), 0),
		RealFollowers: signals.RealFollowers, OriginalPostsLast60Days: signals.OriginalPostsLast60Days, DaysSinceLastViolation: min(signals.DaysSinceLastViolation, 100000),
		FraudScore: signals.FraudScore, RiskScore: signals.RiskScore, BorderlineContent: signals.BorderlineContent,
		EmailVerified: account.EmailVerified, AccountRestricted: !account.Active || account.Status == "suspended", CompletedOrders: signals.CompletedOrders,
		SuccessRatePercent: signals.SuccessRatePercent, HasActiveStoreOrBrandPage: signals.HasActiveStoreOrBrandPage,
		Thresholds: integrations.EligibilityThresholds{
			MinimumAccountAgeDays: rules.Blue.MinimumAccountAgeDays, MinimumRealFollowers: rules.Blue.MinimumRealFollowers, NoViolationsInDays: rules.Blue.NoViolationsInDays,
			MinimumCompletedOrders: rules.Gold.MinimumCompletedOrders, MinimumSuccessRatePercent: rules.Gold.MinimumSuccessRatePercent,
		},
	}, nil
}

func FallbackEligibilityAssessment(signals integrations.EligibilitySignals) integrations.EligibilityAssessment {
	assessment := integrations.EligibilityAssessment{Tier: TierRequest, TrustScore: max(0, 50-signals.FraudScore/2-signals.RiskScore/2), Reasons: []string{"trust_service_unavailable"}, RecheckAfterHours: 6, Source: "fallback"}
	if signals.AccountRestricted {
		assessment.Tier, assessment.TrustScore, assessment.Reasons = TierBlocked, 0, []string{"account_restricted"}
	}
	return assessment
}

func AssessVerificationEligibility(ctx context.Context, application *container.Container, signals integrations.EligibilitySignals) integrations.EligibilityAssessment {
	if application.Eligibility == nil {
		return FallbackEligibilityAssessment(signals)
	}
	assessment, err := application.Eligibility.AssessVerificationEligibility(ctx, signals)
	if err != nil || (assessment.Tier != TierBuyNow && assessment.Tier != TierRequest && assessment.Tier != TierBlocked) {
		return FallbackEligibilityAssessment(signals)
	}
	assessment.TrustScore = min(max(assessment.TrustScore, 0), 100)
	return assessment
}

type EligibilityChange struct {
	Row            *ent.VerificationEligibility
	BecameEligible bool
}

func StoreEligibilityAssessment(ctx context.Context, application *container.Container, profile *ent.Profile, color string, assessment integrations.EligibilityAssessment, requested bool) (EligibilityChange, error) {
	var change EligibilityChange
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		existing, err := tx.VerificationEligibility.Query().Where(verificationeligibility.ProfileID(profile.ID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			existing, err = tx.VerificationEligibility.Create().SetProfileID(profile.ID).SetAccountID(profile.AccountID).SetColor(verificationeligibility.Color(color)).Save(ctx)
		}
		if err != nil {
			return err
		}
		wasQueued := existing.State == verificationeligibility.StateRequested
		state := verificationeligibility.StateAssessed
		switch {
		case assessment.Tier == TierBuyNow:
			state = verificationeligibility.StateEligible
		case requested || wasQueued:
			state = verificationeligibility.StateRequested
		}
		recheckIn := max(time.Duration(assessment.RecheckAfterHours)*time.Hour, application.Settings.Verification.EligibilityRecheckEvery)
		update := existing.Update().SetColor(verificationeligibility.Color(color)).SetState(state).SetTier(verificationeligibility.Tier(assessment.Tier)).
			SetTrustScore(assessment.TrustScore).SetReasons(nonNilStrings(assessment.Reasons)).SetScoreSource(truncateText(assessment.Source, 60)).SetLastCheckedAt(now)
		if requested && existing.RequestedAt == nil {
			update.SetRequestedAt(now)
		}
		if state == verificationeligibility.StateRequested {
			update.SetNextCheckAt(now.Add(recheckIn))
		} else {
			update.ClearNextCheckAt()
		}
		change.BecameEligible = wasQueued && state == verificationeligibility.StateEligible && existing.NotifiedAt == nil
		if change.BecameEligible {
			update.SetNotifiedAt(now)
		}
		if change.Row, err = update.Save(ctx); err != nil {
			return err
		}
		if !change.BecameEligible {
			return nil
		}
		notice := NoticeFor(profile, color)
		notice.DeepLink = application.Settings.Verification.WebAppBaseUrl + "/settings/verification?step=pay"
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationEligibleNoticeType, profile.AccountID.String(), now, notice)
	})
	return change, err
}

func NoticeFor(profile *ent.Profile, color string) verificationevents.VerificationNotice {
	name := profile.DisplayName
	if name == "" {
		name = "@" + profile.Handle
	}
	return verificationevents.VerificationNotice{AccountId: profile.AccountID.String(), Checkmark: color, AccountName: name}
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
