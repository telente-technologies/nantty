package services

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

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

type AdminGovernmentBlackPage struct {
	Items      []AdminGovernmentBlackSummary `json:"data"`
	NextCursor *string                       `json:"nextCursor"`
}

func parseGovernmentBlackCursor(cursor string) (time.Time, uuid.UUID, error) {
	tsPart, idPart, ok := strings.Cut(strings.TrimSpace(cursor), "|")
	if !ok {
		return time.Time{}, uuid.Nil, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "Invalid pagination cursor.")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, tsPart)
	if err != nil {
		return time.Time{}, uuid.Nil, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "Invalid pagination cursor.")
	}
	id, err := uuid.Parse(idPart)
	if err != nil {
		return time.Time{}, uuid.Nil, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "Invalid pagination cursor.")
	}
	return createdAt.UTC(), id, nil
}

func (billing Billing) AdminListGovernmentBlack(ctx context.Context, limit int, cursor string) (AdminGovernmentBlackPage, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	query := client.Subscription.Query().Where(subscription.PlanCodeEQ(constants.PlanBlack))
	if strings.TrimSpace(cursor) != "" {
		cursorAt, cursorId, err := parseGovernmentBlackCursor(cursor)
		if err != nil {
			return AdminGovernmentBlackPage{}, err
		}
		query = query.Where(subscription.Or(
			subscription.CreatedAtLT(cursorAt),
			subscription.And(subscription.CreatedAtEQ(cursorAt), subscription.IDLT(cursorId)),
		))
	}
	rows, err := query.Order(ent.Desc(subscription.FieldCreatedAt), ent.Desc(subscription.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return AdminGovernmentBlackPage{}, err
	}
	var nextCursor *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		encoded := last.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.ID.String()
		nextCursor = &encoded
	}
	out := make([]AdminGovernmentBlackSummary, 0, len(rows))
	for _, row := range rows {
		item := AdminGovernmentBlackSummary{
			Subscription:  billing.convertGovernmentSubscription(ctx, row),
			RecentPeriods: []BillingPeriodView{}, RecentEvents: []BlackBillingEventView{},
		}
		app, found, err := billing.findBlackEligibility(ctx, row.ProfileID)
		if err != nil {
			return AdminGovernmentBlackPage{}, err
		}
		if found {
			item.Verification = &GovernmentVerificationSummary{
				ApplicationId: app.ApplicationId, ProfileId: row.ProfileID, AgencyName: app.AgencyName, Handle: app.Handle,
				Status: app.Status, JurisdictionCountryCode: app.JurisdictionCountryCode, InstitutionalEmail: app.InstitutionalEmail,
				InstitutionalEmailVerified: app.InstitutionalEmailVerified, PrivateCheckoutEnabled: app.PrivateCheckoutEnabled,
				PrivateCheckoutExpiresAt: app.PrivateCheckoutExpiresAt, ReverificationDueAt: app.ReverificationDueAt,
			}
		}
		periods, err := client.SubscriptionPeriod.Query().
			Where(subscriptionperiod.SubscriptionID(row.ID.String())).Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).Limit(10).All(ctx)
		if err != nil {
			return AdminGovernmentBlackPage{}, err
		}
		for _, p := range periods {
			item.RecentPeriods = append(item.RecentPeriods, BillingPeriodView{
				Id: p.ID.String(), Kind: string(p.Kind), Status: string(p.Status), Amount: money(p.AmountDueMinor, p.Currency),
				PeriodStartsAt: p.PeriodStartsAt, PeriodEndsAt: p.PeriodEndsAt, PaidAt: p.PaidAt,
				PaymentReference: p.PaymentReference, FailureReason: p.FailureReason,
				InvoiceNumber: "INV-" + row.ID.String()[:8] + "-" + p.PeriodStartsAt.UTC().Format("20060102"),
			})
		}
		events, err := billing.listBlackBillingEvents(ctx, row.ProfileID, 15)
		if err != nil {
			return AdminGovernmentBlackPage{}, err
		}
		item.RecentEvents = events
		out = append(out, item)
	}
	return AdminGovernmentBlackPage{Items: out, NextCursor: nextCursor}, nil
}

func (billing Billing) AdminPauseGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID, reason string) (GovernmentSubscriptionView, error) {
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
	fresh, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	return billing.convertGovernmentSubscription(ctx, fresh), nil
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
		locked, err = locked.Update().SetStatus(subscription.StatusCanceled).SetCancelAtPeriodEnd(false).SetEndedReason("admin_cancelled").ClearNextChargeAt().SetLastError(truncate(reason, 300)).AddVersion(1).Save(ctx)
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
	fresh, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}

func (billing Billing) AdminRetryGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID, reason string) (GovernmentSubscriptionView, error) {
	if billing.Container.Payments == nil {
		return GovernmentSubscriptionView{}, ErrUsdRecurringUnsupported
	}
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
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	if !found || app.Status != "approved" {
		return GovernmentSubscriptionView{}, ErrBlackVerificationRequired
	}
	if err := billing.chargeDuePeriod(ctx, row); err != nil {
		return GovernmentSubscriptionView{}, err
	}
	summary := "Staff triggered manual renewal charge retry"
	if strings.TrimSpace(reason) != "" {
		summary += ": " + reason
	}
	billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
		SubscriptionId: row.ID.String(), ProfileId: row.ProfileID, OwnerUserId: row.OwnerUserID,
		EventKind: "admin_retry", ActorKind: "staff", ActorId: staffId, Summary: summary,
	})
	fresh, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}

func (billing Billing) AdminReconcileGovernmentBlack(ctx context.Context, staffId string, subscriptionId uuid.UUID, reason string) (GovernmentSubscriptionView, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ID(subscriptionId), subscription.PlanCodeEQ(constants.PlanBlack)).Only(ctx)
	if ent.IsNotFound(err) {
		return GovernmentSubscriptionView{}, ErrSubscriptionMissing
	}
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	if billing.Container.Payments == nil {
		return GovernmentSubscriptionView{}, ErrUsdRecurringUnsupported
	}
	period, pErr := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().
		Where(subscriptionperiod.SubscriptionID(row.ID.String())).Order(ent.Desc(subscriptionperiod.FieldCreatedAt)).First(ctx)
	if pErr != nil && !ent.IsNotFound(pErr) {
		return GovernmentSubscriptionView{}, pErr
	}
	if pErr == nil && period.PaymentReference != "" && period.Status != subscriptionperiod.StatusPaid {
		if _, err := billing.Container.Payments.VerifyAndSettlePaymentIntentByReference(ctx, period.PaymentReference); err != nil && err != paymentservices.ErrPaymentNotFound {
			return GovernmentSubscriptionView{}, httpserver.NewApiError(http.StatusBadGateway, "RECONCILE_FAILED", err.Error())
		}
	}
	summary := "Reconciled Black Government billing state with payment provider"
	if strings.TrimSpace(reason) != "" {
		summary += ": " + reason
	}
	billing.recordBlackBillingEvent(ctx, billing.Container.Resources.Database, BlackBillingEventView{
		SubscriptionId: row.ID.String(), ProfileId: row.ProfileID, OwnerUserId: row.OwnerUserID,
		EventKind: "reconciled", ActorKind: "staff", ActorId: staffId, Summary: summary,
	})
	fresh, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, subscriptionId)
	if err != nil {
		return GovernmentSubscriptionView{}, err
	}
	return billing.convertGovernmentSubscription(ctx, fresh), nil
}
