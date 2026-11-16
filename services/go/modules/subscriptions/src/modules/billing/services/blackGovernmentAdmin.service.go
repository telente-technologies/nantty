package services

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/platform/httpserver"
)

type AdminGovernmentBlackSummary struct {
	Subscription  GovernmentSubscriptionView     `json:"subscription"`
	Verification  *GovernmentVerificationSummary `json:"verification,omitempty"`
	RecentPeriods []BillingPeriodView            `json:"recentPeriods"`
	RecentEvents  []BlackBillingEventView        `json:"recentEvents"`
}

func (billing Billing) AdminListGovernmentBlack(ctx context.Context) ([]AdminGovernmentBlackSummary, error) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.PlanCodeEQ(constants.PlanBlack)).Order(ent.Desc(subscription.FieldCreatedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AdminGovernmentBlackSummary, 0, len(rows))
	for _, row := range rows {
		item := AdminGovernmentBlackSummary{
			Subscription:  billing.convertGovernmentSubscription(ctx, row),
			RecentPeriods: []BillingPeriodView{}, RecentEvents: []BlackBillingEventView{},
		}
		if app, found, err := billing.findBlackEligibility(ctx, row.ProfileID); err == nil && found {
			item.Verification = &GovernmentVerificationSummary{
				ApplicationId: app.ApplicationId, ProfileId: row.ProfileID, AgencyName: app.AgencyName, Handle: app.Handle,
				Status: app.Status, JurisdictionCountryCode: app.JurisdictionCountryCode, InstitutionalEmail: app.InstitutionalEmail,
				InstitutionalEmailVerified: app.InstitutionalEmailVerified, PrivateCheckoutEnabled: app.PrivateCheckoutEnabled,
				PrivateCheckoutExpiresAt: app.PrivateCheckoutExpiresAt, ReverificationDueAt: app.ReverificationDueAt,
			}
		}
		if periods, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().
			Where(subscriptionperiod.SubscriptionID(row.ID.String())).Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).Limit(10).All(ctx); err == nil {
			for _, p := range periods {
				item.RecentPeriods = append(item.RecentPeriods, BillingPeriodView{
					Id: p.ID.String(), Kind: string(p.Kind), Status: string(p.Status), Amount: money(p.AmountDueMinor, p.Currency),
					PeriodStartsAt: p.PeriodStartsAt, PeriodEndsAt: p.PeriodEndsAt, PaidAt: p.PaidAt,
					PaymentReference: p.PaymentReference, FailureReason: p.FailureReason,
					InvoiceNumber: "INV-" + row.ID.String()[:8] + "-" + p.PeriodStartsAt.UTC().Format("20060102"),
				})
			}
		}
		if events, err := billing.listBlackBillingEvents(ctx, row.ProfileID, 15); err == nil {
			item.RecentEvents = events
		}
		out = append(out, item)
	}
	return out, nil
}

func (billing Billing) AdminPauseGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID, reason string) (GovernmentSubscriptionView, error) {
	var out GovernmentSubscriptionView
	err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(subscriptionId), subscription.PlanCodeEQ(constants.PlanBlack)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return ErrSubscriptionMissing
		}
		if err != nil {
			return err
		}
		locked, err = locked.Update().SetStatus(subscription.StatusPaused).ClearNextChargeAt().SetLastError(truncate(reason, 300)).AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `UPDATE subscriptions SET paused_reason = $2 WHERE id = $1`, locked.ID, truncate(reason, 120)); err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: locked.ID.String(), ProfileId: locked.ProfileID, OwnerUserId: locked.OwnerUserID,
			EventKind: "admin_paused", ActorKind: "staff", ActorId: staffId, Summary: "Staff paused Black Government subscription: " + reason,
		})
		return billing.emit(ctx, transaction, "entitlement.paused", locked.ProfileID, entitlementData(locked, string(locked.Status)))
	})
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	out = billing.convertGovernmentSubscription(ctx, fresh)
	return out, nil
}

func (billing Billing) AdminCancelGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID, reason string) (GovernmentSubscriptionView, error) {
	err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(subscriptionId), subscription.PlanCodeEQ(constants.PlanBlack)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return ErrSubscriptionMissing
		}
		if err != nil {
			return err
		}
		locked, err = locked.Update().SetStatus(subscription.StatusCanceled).SetCancelAtPeriodEnd(true).SetEndedReason("admin_cancelled").ClearNextChargeAt().SetLastError(truncate(reason, 300)).AddVersion(1).Save(ctx)
		if err != nil {
			return err
		}
		billing.recordBlackBillingEvent(ctx, transaction, BlackBillingEventView{
			SubscriptionId: locked.ID.String(), ProfileId: locked.ProfileID, OwnerUserId: locked.OwnerUserID,
			EventKind: "admin_cancelled", ActorKind: "staff", ActorId: staffId, Summary: "Staff cancelled Black Government subscription: " + reason,
		})
		return billing.emit(ctx, transaction, "entitlement.revoked", locked.ProfileID, entitlementData(locked, string(locked.Status)))
	})
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}

func (billing Billing) AdminRetryGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID) (GovernmentSubscriptionView, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ID(subscriptionId), subscription.PlanCodeEQ(constants.PlanBlack)).Only(ctx)
	if ent.IsNotFound(err) {
		return GovernmentSubscriptionView{}, ErrSubscriptionMissing
	}
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	if row.BillingAuthorizationID == "" {
		return GovernmentSubscriptionView{}, ErrBlackCardRequired
	}
	app, found, err := billing.findBlackEligibility(ctx, row.ProfileID)
	if err != nil || !found || app.Status != "approved" {
		return GovernmentSubscriptionView{}, ErrBlackVerificationRequired
	}
	if err := billing.chargeDuePeriod(ctx, row); err != nil {
		return GovernmentSubscriptionView{}, err
	}
	billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
		SubscriptionId: row.ID.String(), ProfileId: row.ProfileID, OwnerUserId: row.OwnerUserID,
		EventKind: "admin_retry", ActorKind: "staff", ActorId: staffId, Summary: "Staff triggered manual renewal charge retry",
	})
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}

func (billing Billing) AdminReconcileGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID) (GovernmentSubscriptionView, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ID(subscriptionId), subscription.PlanCodeEQ(constants.PlanBlack)).Only(ctx)
	if ent.IsNotFound(err) {
		return GovernmentSubscriptionView{}, ErrSubscriptionMissing
	}
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	period, pErr := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().
		Where(subscriptionperiod.SubscriptionID(row.ID.String())).Order(ent.Desc(subscriptionperiod.FieldCreatedAt)).First(ctx)
	if pErr == nil && period.PaymentReference != "" && period.Status != subscriptionperiod.StatusPaid {
		if _, err := billing.Container.Payments.VerifyAndSettlePaymentIntentByReference(ctx, period.PaymentReference); err != nil && err != paymentservices.ErrPaymentNotFound {
			return GovernmentSubscriptionView{}, httpserver.NewApiError(http.StatusBadGateway, "RECONCILE_FAILED", err.Error())
		}
	}
	billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
		SubscriptionId: row.ID.String(), ProfileId: row.ProfileID, OwnerUserId: row.OwnerUserID,
		EventKind: "reconciled", ActorKind: "staff", ActorId: staffId, Summary: "Reconciled Black Government billing state with payment provider",
	})
	fresh, _ := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}
