package services

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"nantty/modules/ledger/src/databases"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/models"
)

type JobReport struct {
	TrialsActivated int `json:"trialsActivated"`
	RemindersSent   int `json:"remindersSent"`
	GracesExpired   int `json:"gracesExpired"`
	BundlesLapsed   int `json:"bundlesLapsed"`
	BundlesRepriced int `json:"bundlesRepriced"`
	RenewalsQueued  int `json:"renewalsQueued"`
	NoticesSent     int `json:"noticesSent"`
	OffersReleased  int `json:"offersReleased"`
}

func (billing Billing) RunDueJobs(ctx context.Context) JobReport {
	report := JobReport{}
	report.TrialsActivated = billing.ActivatePendingTrials(ctx, 50)
	report.RemindersSent = billing.SendDueReminders(ctx, 200)
	report.GracesExpired = billing.ExpireGracePeriods(ctx, 200)
	report.BundlesLapsed = billing.LapseBundlesWithoutBlue(ctx, 200)
	report.BundlesRepriced = billing.RepriceLapsedBundles(ctx, 50)
	report.RenewalsQueued = billing.SweepDueSubscriptions(ctx, 200)
	report.NoticesSent = billing.SendCardExpiryNotices(ctx, 100)
	report.OffersReleased = billing.ReleaseExpiredOfferReservations(ctx, 100)
	if billing.Container.Now().UTC().Minute() == 0 {
		report.NoticesSent += billing.SendPriceChangeNotices(ctx, 500)
	}
	return report
}

func (billing Billing) ActivatePendingTrials(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	pending, err := client.Subscription.Query().Where(subscription.ActivationPending(true), subscription.StatusEQ(subscription.StatusAwaitingCard)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	activated := 0
	for _, row := range pending {
		trialEndsAt := billing.Container.Now().UTC().Add(time.Duration(max(row.TrialDays, 1)) * 24 * time.Hour)
		_, err := billing.Container.Payments.StartTrialBillingSubscription(ctx, paymentservices.TrialBillingRequest{
			OwnerUserId: row.OwnerUserID, PlanCode: row.PlanCode, ProviderPlanId: row.ProviderPlanCode, ProviderCustomerId: row.ProviderCustomerID,
			TrialEndsAt: trialEndsAt, Metadata: map[string]string{"subscriptionId": row.ID.String()},
		})
		if err != nil {
			billing.Container.Resources.Logger.WarnContext(ctx, "trial activation failed; retrying on the next run", slog.String("subscriptionId", row.ID.String()), slog.Any("error", err))
			_ = row.Update().SetLastError(truncate(err.Error(), 300)).Exec(ctx)
			continue
		}
		if err := client.Subscription.UpdateOneID(row.ID).SetActivationPending(false).SetLastError("").Exec(ctx); err == nil {
			activated++
		}
	}
	return activated
}

func (billing Billing) ExpireGracePeriods(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	rows, err := client.Subscription.Query().Where(subscription.StatusEQ(subscription.StatusGrace), subscription.BillingAuthorizationIDEQ(""), subscription.GraceEndsAtLTE(billing.Container.Now().UTC())).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	expired := 0
	for _, row := range rows {
		if !models.GraceExpired(string(row.Status), row.GraceEndsAt, billing.Container.Now().UTC()) {
			continue
		}
		err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			updated, err := billing.Container.Client(transaction).Subscription.Update().Where(subscription.ID(row.ID), subscription.StatusEQ(subscription.StatusGrace)).SetStatus(subscription.StatusExpired).Save(ctx)
			if err != nil || updated == 0 {
				return err
			}
			return billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, entitlementData(row, "expired"))
		})
		if err == nil {
			expired++
		}
	}
	return expired
}

func (billing Billing) LapseBundlesWithoutBlue(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	rows, err := client.Subscription.Query().Where(subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...), subscription.BundleLapsesAtIsNil()).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	lapsed := 0
	for _, row := range rows {
		hasBlue, err := billing.ownerHasLiveBlue(ctx, client, row.OwnerUserID)
		if err != nil || hasBlue {
			continue
		}
		lapsesAt := billing.Container.Now().UTC()
		if row.CurrentPeriodEndsAt != nil {
			lapsesAt = *row.CurrentPeriodEndsAt
		}
		err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			if err := billing.Container.Client(transaction).Subscription.UpdateOneID(row.ID).SetBundleLapsesAt(lapsesAt).Exec(ctx); err != nil {
				return err
			}
			return billing.emit(ctx, transaction, "subscription.bundleDiscountLapsed", row.ID.String(), map[string]any{
				"subscriptionId": row.ID.String(), "profileId": row.ProfileID, "ownerUserId": row.OwnerUserID, "lapsesAt": lapsesAt.Format(time.RFC3339),
				"priceAfterLapse": money(row.ListAmountMinor, row.Currency),
			})
		})
		if err == nil {
			lapsed++
		}
	}
	return lapsed
}
