package services

import (
	"context"
	"database/sql"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionofferlink"
	"zudomart/modules/subscriptions/src/models"
)

func (billing Billing) releaseOfferClaimInTransaction(ctx context.Context, client *ent.Client, claim *ent.SubscriptionOfferClaim) error {
	if err := claim.Update().SetStatus(subscriptionofferclaim.StatusReleased).SetReleasedAt(billing.Container.Now().UTC()).Exec(ctx); err != nil {
		return err
	}
	return client.SubscriptionOfferLink.Update().Where(subscriptionofferlink.ID(mustParseUuid(claim.LinkID)), subscriptionofferlink.ClaimedCountGT(0)).AddClaimedCount(-1).Exec(ctx)
}

func (billing Billing) redeemOfferClaimInTransaction(ctx context.Context, client *ent.Client, claimId string) error {
	if claimId == "" {
		return nil
	}
	claim, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.ID(mustParseUuid(claimId))).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) || (err == nil && claim.Status == subscriptionofferclaim.StatusRedeemed) {
		return nil
	}
	if err != nil {
		return err
	}
	link := client.SubscriptionOfferLink.Update().Where(subscriptionofferlink.ID(mustParseUuid(claim.LinkID))).AddRedeemedCount(1)
	if claim.Status == subscriptionofferclaim.StatusReleased {
		link.AddClaimedCount(1)
	}
	if err := link.Exec(ctx); err != nil {
		return err
	}
	return claim.Update().SetStatus(subscriptionofferclaim.StatusRedeemed).SetRedeemedAt(billing.Container.Now().UTC()).ClearReleasedAt().Exec(ctx)
}

func (billing Billing) consumeOfferCycleInTransaction(ctx context.Context, client *ent.Client, update *ent.SubscriptionUpdateOne, row *ent.Subscription, period *ent.SubscriptionPeriod) error {
	if !models.HasOfferDiscountLine(period.LineItems) {
		return nil
	}
	if row.OfferCyclesRemaining > 0 {
		update.AddOfferCyclesRemaining(-1)
	}
	return billing.redeemOfferClaimInTransaction(ctx, client, row.OfferClaimID)
}

func (billing Billing) ReleaseExpiredOfferReservations(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	now := billing.Container.Now().UTC()
	expired, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.StatusEQ(subscriptionofferclaim.StatusReserved), subscriptionofferclaim.ReservedUntilLT(now)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	released := 0
	for _, candidate := range expired {
		didRelease := false
		err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			client := billing.Container.Client(transaction)
			claim, err := client.SubscriptionOfferClaim.Query().Where(subscriptionofferclaim.ID(candidate.ID), subscriptionofferclaim.StatusEQ(subscriptionofferclaim.StatusReserved),
				subscriptionofferclaim.ReservedUntilLT(now)).ForUpdate().Only(ctx)
			if ent.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return err
			}
			if claim.SubscriptionID != "" {
				if err := client.Subscription.Update().Where(subscription.ID(mustParseUuid(claim.SubscriptionID)), subscription.StatusEQ(subscription.StatusPending)).
					SetStatus(subscription.StatusCanceled).SetLastError("The offer reservation ended before payment.").Exec(ctx); err != nil {
					return err
				}
			}
			didRelease = true
			return billing.releaseOfferClaimInTransaction(ctx, client, claim)
		})
		if err == nil && didRelease {
			released++
		}
		if err != nil {
			billing.Container.Resources.Logger.WarnContext(ctx, "offer reservation release failed; retrying on the next run", "claimId", candidate.ID.String(), "error", err.Error())
		}
	}
	return released
}
