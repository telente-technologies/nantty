package services

import (
	"context"
	"database/sql"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"zudomart/modules/subscriptions/src/models"
)

type CombinedGoldChangeView struct {
	Added        []string            `json:"added"`
	Removing     []string            `json:"removing"`
	EffectiveAt  string              `json:"removalsEffectiveAt"`
	Charge       models.PeriodCharge `json:"charge"`
	ChargeStatus string              `json:"chargeStatus,omitempty"`
	ActionUrl    string              `json:"actionUrl,omitempty"`
}

func (billing Billing) ChangeCombinedGoldProfiles(ctx context.Context, userId string, subscriptionId uuid.UUID, profileIds []string, expectedChargeMinor *int64) (CombinedGoldChangeView, error) {
	row, err := billing.ownedEngineRow(ctx, userId, subscriptionId)
	if err != nil {
		return CombinedGoldChangeView{}, err
	}
	if row.PlanCode != constants.PlanGoldCombined || !IsEngineManaged(row) || row.Status != subscription.StatusActive {
		return CombinedGoldChangeView{}, ErrPlanChangeNotAllowed
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	current, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.StatusIn(grantedCoverageStatuses...)).All(ctx)
	if err != nil {
		return CombinedGoldChangeView{}, err
	}
	covered := map[string]*ent.SubscriptionCoveredProfile{}
	for _, entry := range current {
		covered[entry.ProfileID] = entry
	}
	added, removing, restoring := []string{}, []string{}, []string{}
	for _, profileId := range profileIds {
		switch entry := covered[profileId]; {
		case entry == nil:
			added = append(added, profileId)
		case entry.Status == subscriptioncoveredprofile.StatusRemoving:
			restoring = append(restoring, profileId)
		}
	}
	for profileId, entry := range covered {
		if !slices.Contains(profileIds, profileId) && entry.Status == subscriptioncoveredprofile.StatusActive {
			removing = append(removing, profileId)
		}
	}
	if len(added) > 0 {
		if _, err := billing.resolveCombinedGoldProfiles(ctx, userId, profileIds); err != nil {
			return CombinedGoldChangeView{}, err
		}
		if premium, err := billing.ownerHasLivePremium(ctx, client, userId); err != nil || !premium {
			return CombinedGoldChangeView{}, firstError(err, ErrPremiumRequired)
		}
		for _, profileId := range added {
			if err := billing.RequireCheckmarkPurchaseAllowed(ctx, constants.PlanGoldOnly, profileId); err != nil {
				return CombinedGoldChangeView{}, err
			}
		}
	} else if len(profileIds) > billing.combinedGoldRules(ctx).MaximumProfiles+len(removing) {
		return CombinedGoldChangeView{}, ErrCombinedGoldTooManyProfiles
	}
	view := CombinedGoldChangeView{Added: added, Removing: removing, EffectiveAt: dueDateOf(row).UTC().Format(time.RFC3339), Charge: models.PeriodCharge{LineItems: []models.LineItem{}}}
	if len(added) == 0 {
		if expectedChargeMinor != nil && *expectedChargeMinor != 0 {
			return CombinedGoldChangeView{}, ErrCombinedGoldPriceChanged
		}
		return view, billing.scheduleCoverageRemovals(ctx, row, removing, restoring)
	}
	if len(restoring) > 0 {
		if err := billing.scheduleCoverageRemovals(ctx, row, nil, restoring); err != nil {
			return CombinedGoldChangeView{}, err
		}
	}
	return billing.addCoverageWithProration(ctx, row, len(current)+len(added), added, removing, expectedChargeMinor, view)
}

func (billing Billing) scheduleCoverageRemovals(ctx context.Context, row *ent.Subscription, removing, restoring []string) error {
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := billing.Container.Client(transaction)
		if len(restoring) > 0 {
			if err := client.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.ProfileIDIn(restoring...),
				subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusRemoving)).SetStatus(subscriptioncoveredprofile.StatusActive).Exec(ctx); err != nil {
				return err
			}
			if err := client.Subscription.UpdateOneID(row.ID).SetCancelAtPeriodEnd(false).Exec(ctx); err != nil {
				return err
			}
		}
		if err := client.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.ProfileIDIn(removing...),
			subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusActive)).SetStatus(subscriptioncoveredprofile.StatusRemoving).Exec(ctx); err != nil {
			return err
		}
		return billing.cancelCombinedGoldWhenNothingRenewsInTransaction(ctx, client, row)
	})
}

func (billing Billing) addCoverageWithProration(ctx context.Context, row *ent.Subscription, coveredCount int, added, removing []string, expectedChargeMinor *int64, view CombinedGoldChangeView) (CombinedGoldChangeView, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return CombinedGoldChangeView{}, err
	}
	if coveredCount > billing.combinedGoldRules(ctx).MaximumProfiles {
		return CombinedGoldChangeView{}, ErrCombinedGoldTooManyProfiles
	}
	quote, regional, err := billing.priceCombinedGold(ctx, client, row.OwnerUserID, coveredCount, row.Interval.String(), firstNonEmpty(profile.CountryCode, billing.Container.Settings.DefaultCountry), true)
	if err != nil {
		return CombinedGoldChangeView{}, err
	}
	if regional.Currency != row.Currency {
		return CombinedGoldChangeView{}, ErrPlanChangeNotAllowed
	}
	now := billing.Container.Now().UTC()
	periodStart, periodEnd := now.AddDate(0, -1, 0), dueDateOf(row)
	if row.Interval == subscription.IntervalYear {
		periodStart = now.AddDate(-1, 0, 0)
	}
	if paid, err := client.SubscriptionPeriod.Query().Where(subscriptionperiod.SubscriptionID(row.ID.String()), subscriptionperiod.StatusIn(subscriptionperiod.StatusPaid, subscriptionperiod.StatusWaived)).
		Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).First(ctx); err == nil {
		periodStart = paid.PeriodStartsAt
	}
	proration := models.ProrateUpgrade(models.ProrationInput{CurrentPeriodPaidMinor: row.AmountMinor, NewPeriodPriceMinor: quote.TotalMinor, PeriodStartsAt: periodStart, PeriodEndsAt: periodEnd, Now: now})
	if expectedChargeMinor != nil && *expectedChargeMinor != proration.ChargeNowMinor {
		return CombinedGoldChangeView{}, ErrCombinedGoldPriceChanged
	}
	view.Charge = models.PeriodCharge{LineItems: []models.LineItem{
		{Kind: models.LineItemCheckmark, Label: "Gold for your businesses (rest of this period)", AmountMinor: proration.ChargeNowMinor + proration.UnusedCreditMinor},
		{Kind: models.LineItemProrationCredit, Label: "Unused time on your current plan", AmountMinor: -proration.UnusedCreditMinor},
	}, SubtotalMinor: proration.ChargeNowMinor, AmountDueMinor: proration.ChargeNowMinor, CheckmarkIncluded: true}
	periodId := uuid.Must(uuid.NewV7())
	err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		tx := billing.Container.Client(transaction)
		if err := lockGoldProfilesInTransaction(ctx, transaction, added); err != nil {
			return err
		}
		if err := billing.releaseAbandonedCombinedCheckoutsInTransaction(ctx, tx, row.OwnerUserID, added); err != nil {
			return err
		}
		if err := tx.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusPending)).
			SetStatus(subscriptioncoveredprofile.StatusReleased).SetEndedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := billing.refuseProfilesWithOwnGoldInTransaction(ctx, tx, added); err != nil {
			return err
		}
		for _, profileId := range added {
			if err := tx.SubscriptionCoveredProfile.Create().SetSubscriptionID(row.ID.String()).SetOwnerUserID(row.OwnerUserID).SetProfileID(profileId).
				SetActivatesWithPeriodID(periodId.String()).SetCreatedAt(now).Exec(ctx); err != nil {
				if ent.IsConstraintError(err) {
					return ErrProfileCoveredByCombinedGold
				}
				return err
			}
		}
		if len(removing) > 0 {
			if err := tx.SubscriptionCoveredProfile.Update().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.ProfileIDIn(removing...),
				subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusActive)).SetStatus(subscriptioncoveredprofile.StatusRemoving).Exec(ctx); err != nil {
				return err
			}
		}
		if _, err := billing.createFirstPeriodInTransaction(ctx, transaction, firstPeriodRequest{
			SubscriptionId: row.ID, PeriodId: periodId, OwnerUserId: row.OwnerUserID, ProfileId: row.ProfileID, PlanCode: constants.PlanGoldCombined, Interval: row.Interval.String(),
			Currency: row.Currency, Charge: view.Charge, StartsAt: now, Kind: subscriptionperiod.KindUpgrade, EndsAt: &periodEnd, PeriodPrice: quote.TotalMinor,
		}); err != nil {
			return err
		}
		locked, err := tx.Subscription.Query().Where(subscription.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if locked, err = locked.Update().AddCreditMinor(proration.LeftoverCredit).SetCancelAtPeriodEnd(false).Save(ctx); err != nil {
			return err
		}
		if proration.ChargeNowMinor == 0 {
			return billing.settlePeriodInTransaction(ctx, transaction, locked, periodId, "", "", nil)
		}
		return nil
	})
	if err != nil {
		return CombinedGoldChangeView{}, err
	}
	if proration.ChargeNowMinor > 0 {
		result, err := billing.Container.Payments.ChargeBillingAuthorization(ctx, paymentservices.BillingAuthorizationCharge{
			OwnerUserId: row.OwnerUserID, AuthorizationId: row.BillingAuthorizationID, SubjectId: periodId.String(), Reference: models.RenewalChargeReference("upgrade:"+periodId.String(), 1),
			AmountMinor: proration.ChargeNowMinor, Currency: row.Currency, Metadata: map[string]string{"subscriptionId": row.ID.String(), "periodId": periodId.String()},
		})
		if err != nil {
			return CombinedGoldChangeView{}, err
		}
		view.ChargeStatus, view.ActionUrl = result.Status, result.ActionUrl
	}
	return view, nil
}
