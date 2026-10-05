package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionreminder"
	"zudomart/modules/subscriptions/src/generated/ent/trialclaim"
	"zudomart/modules/subscriptions/src/models"
)

func (billing Billing) HandleBillingSubscriptionChanged(ctx context.Context, transaction *sql.Tx, change paymentmodels.BillingSubscriptionChange) error {
	client := billing.Container.Client(transaction)
	row, err := billing.findForBilling(ctx, client, change)
	if err != nil || row == nil || change.Metadata["repricing"] != "" {
		return err
	}
	_, pricing := billing.rules(ctx)
	definition := constants.Plans[row.PlanCode]
	outcome := models.ApplyBillingChange(models.LifecycleInput{
		CurrentStatus: string(row.Status), BillingStatus: change.Status, EventType: change.EventType,
		GracePeriodEligible: definition.GracePeriodEligible, GraceDays: pricing.BlackGraceDays, Now: billing.Container.Now().UTC(),
	})
	update := row.Update().SetStatus(subscription.Status(outcome.Status)).AddVersion(1)
	if row.BillingReference == "" {
		update.SetBillingReference(change.Reference)
	}
	if change.CurrentPeriodEndsAt != nil {
		update.SetCurrentPeriodEndsAt(*change.CurrentPeriodEndsAt)
		row.CurrentPeriodEndsAt = change.CurrentPeriodEndsAt
	}
	if change.TrialEndsAt != nil && outcome.Status == "trialing" {
		update.SetTrialEndsAt(*change.TrialEndsAt)
		row.TrialEndsAt = change.TrialEndsAt
	}
	if outcome.GraceEndsAt != nil {
		update.SetGraceEndsAt(*outcome.GraceEndsAt)
	}
	if outcome.CancelAtPeriodEnd {
		update.SetCancelAtPeriodEnd(true)
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	if outcome.Status == "trialing" && row.TrialEndsAt != nil {
		if err := billing.scheduleTrialRemindersInTransaction(ctx, client, row.ID.String(), *row.TrialEndsAt); err != nil {
			return err
		}
	}
	return billing.emitLifecycleEvents(ctx, transaction, row, outcome)
}

func (billing Billing) findForBilling(ctx context.Context, client *ent.Client, change paymentmodels.BillingSubscriptionChange) (*ent.Subscription, error) {
	if id, err := uuid.Parse(change.Metadata["subscriptionId"]); err == nil {
		row, err := client.Subscription.Query().Where(subscription.ID(id)).ForUpdate().Only(ctx)
		if !ent.IsNotFound(err) {
			return row, err
		}
	}
	row, err := client.Subscription.Query().Where(subscription.BillingReference(change.Reference)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (billing Billing) scheduleTrialRemindersInTransaction(ctx context.Context, client *ent.Client, subscriptionId string, trialEndsAt time.Time) error {
	for daysBefore, dueAt := range models.TrialReminderDueTimes(trialEndsAt) {
		err := client.SubscriptionReminder.Create().SetSubscriptionID(subscriptionId).SetKind("trialEnding").SetDaysBefore(daysBefore).SetDueAt(dueAt).SetCreatedAt(billing.Container.Now()).
			OnConflictColumns(subscriptionreminder.FieldSubscriptionID, subscriptionreminder.FieldKind, subscriptionreminder.FieldDaysBefore).DoNothing().Exec(ctx)
		if err != nil && err != sql.ErrNoRows {
			return err
		}
	}
	return nil
}

func (billing Billing) emitLifecycleEvents(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, outcome models.LifecycleOutcome) error {
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return err
	}
	base := map[string]any{"accountId": row.OwnerUserID, "storeName": profile.DisplayName, "plan": row.PlanCode, "price": money(row.AmountMinor, row.Currency), "interval": row.Interval.String()}
	now := billing.Container.Now().UTC()
	for _, eventType := range outcome.Events {
		data := map[string]any{}
		for key, value := range base {
			data[key] = value
		}
		switch eventType {
		case "planTrial.started":
			data["trialEndsAt"], data["cardLabel"], data["verificationCharge"] = isoTime(row.TrialEndsAt), row.CardLabel, money(0, row.Currency)
		case "planTrial.converted":
			data["nextBillingAt"], data["invoiceNumber"] = isoTime(row.CurrentPeriodEndsAt), "INV-"+row.ID.String()[:8]+"-"+now.Format("20060102")
		case "planInvoice.paid":
			data["invoiceNumber"], data["paidAt"], data["periodStart"], data["periodEnd"] = "INV-"+row.ID.String()[:8]+"-"+now.Format("20060102"), now.Format(time.RFC3339), now.Format(time.RFC3339), isoTime(row.CurrentPeriodEndsAt)
			data["cardLabel"], data["vat"] = row.CardLabel, money(0, row.Currency)
			if row.DiscountKind != subscription.DiscountKindNone {
				data["discount"] = money(row.ListAmountMinor-row.AmountMinor, row.Currency)
			}
		case "planInvoice.paymentFailed":
			data["cardLabel"], data["reason"], data["retryAt"], data["downgradeAt"] = row.CardLabel, "The renewal payment did not go through", now.Add(24*time.Hour).Format(time.RFC3339), isoTime(row.CurrentPeriodEndsAt)
		default:
			data = entitlementData(row, outcome.Status)
		}
		if err := billing.emit(ctx, transaction, eventType, row.ID.String(), data); err != nil {
			return err
		}
	}
	if outcome.Entitlement != "" {
		return billing.emit(ctx, transaction, "entitlement."+outcome.Entitlement, row.ProfileID, entitlementData(row, outcome.Status))
	}
	return nil
}

func (billing Billing) HandleSavedCardFingerprint(ctx context.Context, transaction *sql.Tx, card paymentmodels.SavedCardFingerprint) error {
	if card.Purpose != "trial" {
		return nil
	}
	subscriptionId, err := uuid.Parse(card.SubjectId)
	if err != nil {
		return nil
	}
	client := billing.Container.Client(transaction)
	row, err := client.Subscription.Query().Where(subscription.ID(subscriptionId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) || (err == nil && row.Status != subscription.StatusAwaitingCard) {
		return nil
	}
	if err != nil {
		return err
	}
	trialRules, _ := billing.rules(ctx)
	if trialRules.OnePerCard && card.FingerprintHash != "" {
		claimed, err := client.TrialClaim.Query().Where(trialclaim.KindEQ(trialclaim.KindCard), trialclaim.FingerprintHash(card.FingerprintHash)).Exist(ctx)
		if err != nil {
			return err
		}
		if claimed {
			if err := row.Update().SetStatus(subscription.StatusTrialRejected).SetLastError("CARD_ALREADY_USED").Exec(ctx); err != nil {
				return err
			}
			return billing.emit(ctx, transaction, "subscription.trialRejected", row.ID.String(), map[string]any{"subscriptionId": row.ID.String(), "ownerUserId": row.OwnerUserID, "reason": "CARD_ALREADY_USED"})
		}
		if err := client.TrialClaim.Create().SetKind(trialclaim.KindCard).SetFingerprintHash(card.FingerprintHash).SetSubscriptionID(row.ID.String()).SetOwnerUserID(row.OwnerUserID).SetCreatedAt(billing.Container.Now()).Exec(ctx); err != nil {
			return err
		}
	}
	if card.BillingAuthorizationId == "" {
		if err := row.Update().SetStatus(subscription.StatusTrialRejected).SetLastError("CARD_NOT_REUSABLE").Exec(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "subscription.trialRejected", row.ID.String(), map[string]any{"subscriptionId": row.ID.String(), "ownerUserId": row.OwnerUserID, "reason": "CARD_NOT_REUSABLE"})
	}
	return billing.startTrialInTransaction(ctx, transaction, row, card)
}

func (billing Billing) startTrialInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, card paymentmodels.SavedCardFingerprint) error {
	trialEndsAt := billing.Container.Now().UTC().Add(time.Duration(max(row.TrialDays, 1)) * 24 * time.Hour)
	row, err := row.Update().SetStatus(subscription.StatusTrialing).SetTrialEndsAt(trialEndsAt).SetCurrentPeriodEndsAt(trialEndsAt).SetNextChargeAt(trialEndsAt).
		SetBillingAnchorAt(trialEndsAt).SetBillingAuthorizationID(card.BillingAuthorizationId).SetProviderCustomerID(card.ProviderCustomerId).
		SetCardLabel(truncate(card.CardLabel, 60)).SetCardExpiryMonth(card.CardExpiryMonth).SetCardExpiryYear(card.CardExpiryYear).SetActivationPending(false).AddVersion(1).Save(ctx)
	if err != nil {
		return err
	}
	if err := billing.scheduleTrialRemindersInTransaction(ctx, billing.Container.Client(transaction), row.ID.String(), trialEndsAt); err != nil {
		return err
	}
	return billing.emitLifecycleEvents(ctx, transaction, row, models.LifecycleOutcome{Status: "trialing", Entitlement: "granted", Events: []string{"planTrial.started"}})
}
