package services

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/platform/httpserver"
)

var (
	ErrPlanChangeNotAllowed = httpserver.NewApiError(http.StatusConflict, "PLAN_CHANGE_NOT_ALLOWED", "This subscription can't change plan right now.")
	ErrNothingToPay         = httpserver.NewApiError(http.StatusConflict, "NOTHING_TO_PAY", "There is no unpaid amount on this subscription.")
)

type PlanChangeView struct {
	Subscription SubscriptionView    `json:"subscription"`
	Change       string              `json:"change"`
	EffectiveAt  string              `json:"effectiveAt"`
	Charge       models.PeriodCharge `json:"charge"`
	ChargeStatus string              `json:"chargeStatus,omitempty"`
	ActionUrl    string              `json:"actionUrl,omitempty"`
}

func (billing Billing) ownedEngineRow(ctx context.Context, userId string, subscriptionId uuid.UUID) (*ent.Subscription, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().Where(subscription.ID(subscriptionId), subscription.OwnerUserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrSubscriptionMissing
	}
	return row, err
}

func (billing Billing) ChangePlan(ctx context.Context, userId string, subscriptionId uuid.UUID, planCode, interval string) (PlanChangeView, error) {
	row, err := billing.ownedEngineRow(ctx, userId, subscriptionId)
	if err != nil {
		return PlanChangeView{}, err
	}
	definition, known := constants.Plans[planCode]
	if !known || !definition.SelfServe || !PlanAllowedForProfile(planCode, row.ProfileType) {
		return PlanChangeView{}, ErrProfileNotEligible
	}
	if !IsEngineManaged(row) || row.CancelAtPeriodEnd || (row.Status != subscription.StatusActive && row.Status != subscription.StatusTrialing) || (planCode == row.PlanCode && interval == row.Interval.String()) {
		return PlanChangeView{}, ErrPlanChangeNotAllowed
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	now := billing.Container.Now().UTC()
	next, err := billing.PlanNextPeriod(ctx, client, row, now, planCode, interval)
	if err != nil {
		return PlanChangeView{}, err
	}
	currentPrice := max(row.PeriodPriceMinor, row.AmountMinor)
	upgrade := models.IsUpgrade(models.MonthlyEquivalent(currentPrice, row.Interval.String()), row.Interval.String(), models.MonthlyEquivalent(next.PeriodPriceMinor, interval), interval)
	if !upgrade || row.Status == subscription.StatusTrialing {
		return billing.schedulePlanChange(ctx, row, planCode, interval, next, upgrade)
	}
	periodStart := now.AddDate(0, -1, 0)
	if row.Interval == subscription.IntervalYear {
		periodStart = now.AddDate(-1, 0, 0)
	}
	periodEnd := dueDateOf(row)
	if period, err := client.SubscriptionPeriod.Query().Where(subscriptionperiod.SubscriptionID(row.ID.String()), subscriptionperiod.StatusIn(subscriptionperiod.StatusPaid, subscriptionperiod.StatusWaived)).
		Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).First(ctx); err == nil {
		periodStart = period.PeriodStartsAt
	}
	restart := interval != row.Interval.String()
	proration := models.ProrateUpgrade(models.ProrationInput{
		CurrentPeriodPaidMinor: row.AmountMinor, NewPeriodPriceMinor: next.Charge.SubtotalMinor + next.Charge.CreditAppliedMinor, PeriodStartsAt: periodStart, PeriodEndsAt: periodEnd, Now: now, RestartPeriod: restart,
	})
	charge := models.PeriodCharge{LineItems: []models.LineItem{
		{Kind: models.LineItemPlanBase, Label: PlanLabel(planCode) + " (rest of this period)", AmountMinor: proration.ChargeNowMinor + proration.UnusedCreditMinor},
		{Kind: models.LineItemProrationCredit, Label: "Unused time on " + PlanLabel(row.PlanCode), AmountMinor: -proration.UnusedCreditMinor},
	}, SubtotalMinor: proration.ChargeNowMinor, AmountDueMinor: proration.ChargeNowMinor, CheckmarkIncluded: next.Charge.CheckmarkIncluded}
	var ends *time.Time
	if restart {
		end := models.NextPeriodEnd(now, now.Day(), interval)
		ends = &end
	} else {
		ends = &periodEnd
	}
	periodId := uuid.Must(uuid.NewV7())
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := billing.createFirstPeriodInTransaction(ctx, transaction, firstPeriodRequest{
			SubscriptionId: row.ID, PeriodId: periodId, OwnerUserId: row.OwnerUserID, ProfileId: row.ProfileID, PlanCode: planCode, Interval: interval, Currency: next.Currency,
			Charge: charge, StartsAt: now, Kind: subscriptionperiod.KindUpgrade, EndsAt: ends, PeriodPrice: next.PeriodPriceMinor,
		}); err != nil {
			return err
		}
		locked, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if proration.LeftoverCredit > 0 {
			if locked, err = locked.Update().AddCreditMinor(proration.LeftoverCredit).Save(ctx); err != nil {
				return err
			}
		}
		if proration.ChargeNowMinor == 0 {
			return billing.settlePeriodInTransaction(ctx, transaction, locked, periodId, "", "", nil)
		}
		return nil
	})
	if err != nil {
		return PlanChangeView{}, err
	}
	view := PlanChangeView{Change: "upgrade", EffectiveAt: now.Format(time.RFC3339), Charge: charge}
	if proration.ChargeNowMinor > 0 {
		result, err := billing.Container.Payments.ChargeBillingAuthorization(ctx, paymentservices.BillingAuthorizationCharge{
			OwnerUserId: row.OwnerUserID, AuthorizationId: row.BillingAuthorizationID, SubjectId: periodId.String(), Reference: models.RenewalChargeReference("upgrade:"+periodId.String(), 1),
			AmountMinor: proration.ChargeNowMinor, Currency: next.Currency, Metadata: map[string]string{"subscriptionId": row.ID.String(), "periodId": periodId.String()},
		})
		if err != nil {
			return PlanChangeView{}, err
		}
		view.ChargeStatus, view.ActionUrl = result.Status, result.ActionUrl
	}
	return billing.withFreshSubscription(ctx, row.ID, view)
}

func (billing Billing) schedulePlanChange(ctx context.Context, row *ent.Subscription, planCode, interval string, next NextPeriodPlan, upgrade bool) (PlanChangeView, error) {
	err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		update := billing.Container.Client(transaction).Subscription.UpdateOneID(row.ID)
		if row.Status == subscription.StatusTrialing {
			update.SetPlanCode(planCode).SetInterval(subscription.Interval(interval)).SetAmountMinor(next.Charge.SubtotalMinor).SetCurrency(next.Currency).SetPeriodPriceMinor(next.PeriodPriceMinor)
		} else {
			update.SetPendingPlanCode(planCode).SetPendingInterval(interval)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "subscription.planChangeScheduled", row.ID.String(), map[string]any{
			"subscriptionId": row.ID.String(), "accountId": row.OwnerUserID, "fromPlan": row.PlanCode, "toPlan": planCode, "interval": interval, "effectiveAt": dueDateOf(row).UTC().Format(time.RFC3339),
		})
	})
	if err != nil {
		return PlanChangeView{}, err
	}
	change := "downgrade"
	if upgrade {
		change = "trialPlanChange"
	}
	return billing.withFreshSubscription(ctx, row.ID, PlanChangeView{Change: change, EffectiveAt: dueDateOf(row).UTC().Format(time.RFC3339), Charge: next.Charge})
}

func (billing Billing) withFreshSubscription(ctx context.Context, id uuid.UUID, view PlanChangeView) (PlanChangeView, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, id)
	if err != nil {
		return PlanChangeView{}, err
	}
	view.Subscription = ConvertSubscription(row)
	return view, nil
}

func (billing Billing) PayOutstandingPeriod(ctx context.Context, userId string, subscriptionId uuid.UUID, returnTo string) (CheckoutView, error) {
	row, err := billing.ownedEngineRow(ctx, userId, subscriptionId)
	if err != nil {
		return CheckoutView{}, err
	}
	if row.Status != subscription.StatusPastDue && row.Status != subscription.StatusGrace {
		return CheckoutView{}, ErrNothingToPay
	}
	period, err := billing.ensureDuePeriod(ctx, row)
	if err != nil {
		return CheckoutView{}, err
	}
	if period.Status == subscriptionperiod.StatusPaid || period.AmountDueMinor == 0 {
		return CheckoutView{}, ErrNothingToPay
	}
	var intentId uuid.UUID
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		intent, err := billing.Container.Payments.CreatePendingPaymentIntentInTransaction(ctx, transaction, paymentmodels.CreatePaymentIntentRequest{
			Purpose: paymentconstants.PurposeSubscriptionRenewal, OwnerUserId: row.OwnerUserID, SubjectId: period.ID.String(), AmountMinor: period.AmountDueMinor,
			Currency: period.Currency, ReturnTo: returnTo, Metadata: map[string]string{"subscriptionId": row.ID.String(), "periodId": period.ID.String(), "idempotencyKey": period.IdempotencyKey},
		})
		intentId = intent.Id
		return err
	})
	if err != nil {
		return CheckoutView{}, err
	}
	opened, err := billing.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		return CheckoutView{}, err
	}
	view := CheckoutView{SubscriptionId: row.ID.String(), Provider: "flutterwave", Price: money(period.AmountDueMinor, period.Currency), LineItems: period.LineItems, Reference: opened.Reference}
	if opened.CheckoutUrl != nil {
		view.AuthorizationUrl = *opened.CheckoutUrl
	}
	return view, nil
}
