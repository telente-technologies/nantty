package applyentitlement

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/profilesignal"
	businessservices "zudomart/modules/users/src/modules/businessDocuments/services"
	"zudomart/modules/users/src/modules/checkmarks/services"
	verificationservices "zudomart/modules/users/src/modules/identityVerification/services"
)

type Decision struct {
	Checkmark       profilecheckmark.Color
	CheckmarkStatus profilecheckmark.Status
	ChangeCheckmark bool
	SellerPlan      profilesignal.SellerPlan
	ChangeSeller    bool
	Premium         bool
	ChangePremium   bool
}

func DecideEntitlementChange(command Command, profileColor profilecheckmark.Color, goldVerified bool) Decision {
	active := command.EventType == "entitlement.granted"
	grace := command.EventType == "entitlement.graceStarted"
	decision := Decision{}
	if color := profilecheckmark.Color(strings.ToLower(command.Checkmark)); color != "" && color == profileColor && (color != profilecheckmark.ColorGold || goldVerified || !active) {
		decision.Checkmark, decision.ChangeCheckmark = color, true
		switch {
		case active:
			decision.CheckmarkStatus = profilecheckmark.StatusVerified
		case grace:
			decision.CheckmarkStatus = profilecheckmark.StatusGrace
		default:
			decision.CheckmarkStatus = profilecheckmark.StatusExpired
		}
	}
	if plan := strings.ToUpper(command.SellerPlan); plan == "PRO" || plan == "BUSINESS" {
		decision.ChangeSeller, decision.SellerPlan = true, profilesignal.SellerPlanFREE
		if active || grace {
			decision.SellerPlan = profilesignal.SellerPlan(plan)
		}
	}
	if command.Plan == "premium" {
		decision.ChangePremium, decision.Premium = true, active || grace
	}
	return decision
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	profileId, err := uuid.Parse(command.ProfileId)
	if err != nil {
		return nil
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		owner, err := tx.Profile.Get(ctx, profileId)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		goldVerified, err := businessservices.AllDocumentsApproved(ctx, tx.Client(), owner.AccountID)
		if err != nil {
			return err
		}
		color := services.ColorForProfileType(owner.ProfileType)
		decision := DecideEntitlementChange(command, color, goldVerified)
		existing, err := tx.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(owner.ID)).Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		opened, err := openVerificationCaseWhenIdentityUnverified(ctx, tx, handler.Container.Now(), owner, existing, DecideEntitlementChange(command, color, true), command)
		if err != nil {
			return err
		}
		if decision.ChangeCheckmark && !opened {
			protected := existing != nil && (existing.Source == profilecheckmark.SourceLifetimeGrant || existing.Status == profilecheckmark.StatusRevoked || existing.Status == profilecheckmark.StatusSuspended)
			skipRevoke := existing == nil && decision.CheckmarkStatus != profilecheckmark.StatusVerified
			if !protected && !skipRevoke {
				change := services.CheckmarkChange{Profile: owner, Color: decision.Checkmark, Status: decision.CheckmarkStatus, Source: profilecheckmark.SourceSubscription, CurrentPeriodEnd: command.ValidUntil}
				if existing != nil && existing.Source == profilecheckmark.SourceBlackVetting {
					change.Source, change.ReserveHandle, change.ReverificationDueAt = existing.Source, existing.HandleReserved, existing.ReverificationDueAt
				}
				if _, err := services.SetProfileCheckmarkInTransaction(ctx, tx, handler.Container.Now(), change); err != nil {
					return err
				}
			}
		}
		if !decision.ChangeSeller && !decision.ChangePremium {
			return nil
		}
		return upsertPlanSignals(ctx, tx, owner, decision, command)
	})
}

func upsertPlanSignals(ctx context.Context, tx *ent.Tx, owner *ent.Profile, decision Decision, command Command) error {
	if _, err := tx.ProfileSignal.Query().Where(profilesignal.ProfileID(owner.ID)).ForUpdate().Only(ctx); ent.IsNotFound(err) {
		if err := tx.ProfileSignal.Create().SetProfileID(owner.ID).SetAccountID(owner.AccountID).SetSource("entitlements").Exec(ctx); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	update := tx.ProfileSignal.Update().Where(profilesignal.ProfileID(owner.ID))
	if decision.ChangeSeller {
		update.SetSellerPlan(decision.SellerPlan).SetSellerPlanTrialing(command.Status == "trialing" && decision.SellerPlan != profilesignal.SellerPlanFREE).SetNillableSellerPlanUntil(command.ValidUntil)
	}
	if decision.ChangePremium {
		if decision.Premium && command.ValidUntil != nil {
			update.SetPremiumUntil(*command.ValidUntil)
		} else {
			update.ClearPremiumUntil()
		}
	}
	return update.Exec(ctx)
}

// openVerificationCaseWhenIdentityUnverified implements "pay first, verify after": a paid Blue or Gold plan opens a
// Smile ID case instead of switching the badge on, unless this profile already passed identity verification.
func openVerificationCaseWhenIdentityUnverified(ctx context.Context, tx *ent.Tx, now time.Time, owner *ent.Profile, existing *ent.ProfileCheckmark, decision Decision, command Command) (bool, error) {
	if command.EventType != "entitlement.granted" || command.SubscriptionId == "" || !decision.ChangeCheckmark || decision.Checkmark == profilecheckmark.ColorBlack {
		return false, nil
	}
	if existing != nil && (services.BadgeVisible(existing.Status) || existing.Source == profilecheckmark.SourceLifetimeGrant || existing.Status == profilecheckmark.StatusRevoked || existing.Status == profilecheckmark.StatusSuspended) {
		return false, nil
	}
	verified, err := verificationservices.IdentityAlreadyVerified(ctx, tx, owner.ID)
	if err != nil || verified {
		return false, err
	}
	_, err = verificationservices.OpenVerificationCaseInTransaction(ctx, tx, now, verificationservices.OpenCaseRequest{
		Profile: owner, Color: string(decision.Checkmark), SubscriptionId: command.SubscriptionId, PlanCode: command.Plan, Channel: command.Channel,
	})
	return err == nil, err
}
