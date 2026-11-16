package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/regionpricing"
)

type GovernmentReactivationView struct {
	Subscription GovernmentSubscriptionView `json:"subscription"`
	ChargeStatus string                     `json:"chargeStatus,omitempty"`
	ActionUrl    string                     `json:"actionUrl,omitempty"`
	Reactivated  bool                       `json:"reactivated"`
}

func (billing Billing) StartGovernmentBlackCardReplacement(ctx context.Context, userId, profileId, returnTo string) (paymentservices.StartedSavedCardSetup, error) {
	profile, err := billing.resolveGovernmentProfile(ctx, userId, profileId)
	if err != nil {
		return paymentservices.StartedSavedCardSetup{}, err
	}
	app, found, err := billing.findBlackEligibility(ctx, profile.ProfileId)
	if err != nil {
		return paymentservices.StartedSavedCardSetup{}, err
	}
	if !found || app.Status != "approved" {
		return paymentservices.StartedSavedCardSetup{}, ErrBlackVerificationRequired
	}
	row, err := billing.latestBlackSubscription(ctx, profile.ProfileId)
	if err != nil {
		return paymentservices.StartedSavedCardSetup{}, err
	}
	if row == nil {
		return paymentservices.StartedSavedCardSetup{}, ErrSubscriptionMissing
	}
	if !billing.Container.Payments.SupportsRecurringCardCurrency(regionpricing.BlackCurrencyCode) {
		return paymentservices.StartedSavedCardSetup{}, ErrUsdRecurringUnsupported
	}
	started, err := billing.Container.Payments.StartSavedCardSetup(ctx, paymentservices.CardSetupRequest{
		UserId: userId, ReturnTo: returnTo, Purpose: "black_card", SubjectId: row.ID.String(),
		AmountMinor: 100, Currency: regionpricing.BlackCurrencyCode,
		Metadata: map[string]string{"profileId": profile.ProfileId, "subscriptionId": row.ID.String()},
	})
	if err == nil {
		billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
			SubscriptionId: row.ID.String(), ApplicationId: app.ApplicationId, ProfileId: profile.ProfileId, OwnerUserId: userId,
			EventKind: "card_replacement_started", ActorKind: "user", ActorId: userId, Summary: "Started USD recurring card replacement",
		})
	}
	return started, err
}

func (billing Billing) ReactivateGovernmentBlackSubscription(ctx context.Context, userId, profileId string) (GovernmentReactivationView, error) {
	profile, err := billing.resolveGovernmentProfile(ctx, userId, profileId)
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	app, found, err := billing.findBlackEligibility(ctx, profile.ProfileId)
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	if !found || app.Status != "approved" || !app.InstitutionalEmailVerified {
		return GovernmentReactivationView{}, ErrBlackVerificationRequired
	}
	row, err := billing.latestBlackSubscription(ctx, profile.ProfileId)
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	if row == nil {
		return GovernmentReactivationView{}, ErrSubscriptionMissing
	}
	if row.BillingAuthorizationID == "" {
		return GovernmentReactivationView{}, ErrBlackCardRequired
	}
	card, err := billing.Container.Payments.DescribeBillingAuthorization(ctx, row.BillingAuthorizationID)
	if err != nil || !card.Usable {
		return GovernmentReactivationView{}, ErrBlackCardRequired
	}
	now := billing.Container.Now().UTC()
	if row.CurrentPeriodEndsAt != nil && row.CurrentPeriodEndsAt.After(now) {
		err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(row.ID)).ForUpdate().Only(ctx)
			if err != nil {
				return err
			}
			locked, err = locked.Update().SetStatus(subscription.StatusActive).SetCancelAtPeriodEnd(false).SetNextChargeAt(*locked.CurrentPeriodEndsAt).SetLastError("").AddVersion(1).Save(ctx)
			if err != nil {
				return err
			}
			if _, err := transaction.ExecContext(ctx, `UPDATE subscriptions SET paused_reason = '' WHERE id = $1`, locked.ID); err != nil {
				return err
			}
			billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
				SubscriptionId: locked.ID.String(), ApplicationId: app.ApplicationId, ProfileId: locked.ProfileID, OwnerUserId: locked.OwnerUserID,
				EventKind: "reactivated", ActorKind: "user", ActorId: userId, Summary: "Reactivated Black Government subscription within active paid period",
			})
			return billing.emit(ctx, transaction, "entitlement.granted", locked.ProfileID, entitlementData(locked, string(locked.Status)))
		})
		if err != nil {
			return GovernmentReactivationView{}, err
		}
		fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, row.ID)
		return GovernmentReactivationView{Subscription: billing.convertGovernmentSubscription(ctx, fresh), Reactivated: true}, nil
	}
	price, err := billing.resolveAuthoritativeBlackPrice(ctx, app.JurisdictionCountryCode)
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	periodId := uuid.Must(uuid.NewV7())
	charge := models.PeriodCharge{
		LineItems: []models.LineItem{{Kind: models.LineItemPlanBase, Label: "Black Government (Monthly)", AmountMinor: price.WebMonthlyMinor}},
		SubtotalMinor: price.WebMonthlyMinor, AmountDueMinor: price.WebMonthlyMinor, CheckmarkIncluded: true,
	}
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		key := models.RenewalIdempotencyKey(row.ID.String(), now)
		if err := billing.Container.Client(transaction).SubscriptionPeriod.Create().SetID(periodId).SetSubscriptionID(row.ID.String()).
			SetKind(subscriptionperiod.KindRenewal).SetPlanCode(constants.PlanBlack).SetInterval("month").
			SetPeriodStartsAt(now).SetPeriodEndsAt(models.NextPeriodEnd(now, now.Day(), "month")).
			SetLineItems(charge.LineItems).SetPeriodPriceMinor(price.WebMonthlyMinor).SetSubtotalMinor(price.WebMonthlyMinor).
			SetCreditAppliedMinor(0).SetAmountDueMinor(price.WebMonthlyMinor).SetCurrency(regionpricing.BlackCurrencyCode).
			SetCheckmarkIncluded(true).SetIdempotencyKey(key).SetCreatedAt(now).Exec(ctx); err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: row.ID.String(), ApplicationId: app.ApplicationId, ProfileId: row.ProfileID, OwnerUserId: userId,
			EventKind: "reactivation_charge_started", ActorKind: "user", ActorId: userId, Summary: "Initiated reactivation USD monthly charge",
		})
		return nil
	})
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	res, err := billing.Container.Payments.ChargeBillingAuthorization(ctx, paymentservices.BillingAuthorizationCharge{
		OwnerUserId: row.OwnerUserID, AuthorizationId: row.BillingAuthorizationID, SubjectId: periodId.String(),
		Reference: models.RenewalChargeReference("reactivate:"+periodId.String(), 1), AmountMinor: price.WebMonthlyMinor,
		Currency: regionpricing.BlackCurrencyCode, Metadata: map[string]string{"subscriptionId": row.ID.String(), "periodId": periodId.String()},
	})
	if err != nil {
		return GovernmentReactivationView{}, err
	}
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, row.ID)
	return GovernmentReactivationView{
		Subscription: billing.convertGovernmentSubscription(ctx, fresh),
		ChargeStatus: res.Status, ActionUrl: res.ActionUrl, Reactivated: res.Status == paymentservices.BillingChargeSucceeded,
	}, nil
}

func (billing Billing) CancelGovernmentBlackSubscription(ctx context.Context, userId, profileId string) (GovernmentSubscriptionView, error) {
	profile, err := billing.resolveGovernmentProfile(ctx, userId, profileId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	row, err := billing.latestBlackSubscription(ctx, profile.ProfileId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	if row == nil {
		return GovernmentSubscriptionView{}, ErrSubscriptionMissing
	}
	if _, err := billing.CancelSubscription(ctx, userId, row.ID); err != nil {
		return GovernmentSubscriptionView{}, err
	}
	billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
		SubscriptionId: row.ID.String(), ProfileId: profile.ProfileId, OwnerUserId: userId,
		EventKind: "cancelled", ActorKind: "user", ActorId: userId, Summary: "Organization scheduled cancellation of Black Government subscription",
	})
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, row.ID)
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}

func (billing Billing) HandleBillingAuthorizationRevoked(ctx context.Context, transaction *sql.Tx, revoked paymentmodels.BillingAuthorizationRevoked) error {
	client := billing.Container.Client(transaction)
	rows, err := client.Subscription.Query().Where(
		subscription.OwnerUserID(revoked.OwnerUserId),
		subscription.PlanCodeEQ(constants.PlanBlack),
		subscription.BillingAuthorizationID(revoked.AuthorizationId),
		subscription.StatusIn(subscription.StatusActive, subscription.StatusPastDue, subscription.StatusTrialing, subscription.StatusGrace),
	).ForUpdate().All(ctx)
	if err != nil {
		return err
	}
	reason := firstNonEmpty(revoked.Reason, "payment_method_removed")
	for _, row := range rows {
		updated, err := row.Update().SetStatus(subscription.StatusPaused).ClearNextChargeAt().SetLastError("Recurring card authorization removed.").AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `UPDATE subscriptions SET paused_reason = $2 WHERE id = $1`, updated.ID, reason); err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: updated.ID.String(), ProfileId: updated.ProfileID, OwnerUserId: updated.OwnerUserID,
			EventKind: "card_removed_paused", ActorKind: "user", ActorId: revoked.OwnerUserId,
			Summary: "Paused Black subscription and entitlement because recurring card authorization was removed",
			Metadata: map[string]any{"authorizationId": revoked.AuthorizationId, "reason": reason},
		})
		if err := billing.emit(ctx, transaction, "entitlement.paused", updated.ProfileID, entitlementData(updated, string(updated.Status))); err != nil {
			return err
		}
		if err := billing.emit(ctx, transaction, "blackSubscription.paused", updated.ID.String(), map[string]any{
			"subscriptionId": updated.ID.String(), "accountId": updated.OwnerUserID, "profileId": updated.ProfileID, "reason": reason,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (billing Billing) HandleBlackApplicationDecidedEvent(ctx context.Context, profileId, status, reason string) error {
	if status != "revoked" {
		return nil
	}
	row, err := billing.latestBlackSubscription(ctx, profileId)
	if err != nil || row == nil {
		return err
	}
	if row.Status == subscription.StatusCanceled || row.Status == subscription.StatusDowngraded || row.Status == subscription.StatusExpired {
		return nil
	}
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		locked, err = locked.Update().SetStatus(subscription.StatusCanceled).SetEndedReason("verification_revoked").SetCancelAtPeriodEnd(true).ClearNextChargeAt().AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: locked.ID.String(), ProfileId: locked.ProfileID, OwnerUserId: locked.OwnerUserID,
			EventKind: "verification_revoked_sync", ActorKind: "system",
			Summary: "Ended Black billing entitlement after government verification revocation", Metadata: map[string]any{"reason": reason},
		})
		return billing.emit(ctx, transaction, "entitlement.revoked", locked.ProfileID, entitlementData(locked, string(locked.Status)))
	})
}
