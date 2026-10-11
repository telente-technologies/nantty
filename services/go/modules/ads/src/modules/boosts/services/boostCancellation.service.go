package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adfreeboostgrant"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/generated/ent/adimpression"
	"zudomart/modules/ads/src/types"
	platformevents "zudomart/platform/events"
)

const (
	CancelReasonPostDeleted = "postDeleted"
	CancelReasonOwner       = "ownerCancelled"
)

var cancellableBoostStatuses = []adboost.Status{adboost.StatusPendingPayment, adboost.StatusInReview, adboost.StatusActive}

func CancelBoostsForPost(ctx context.Context, deployed *container.Container, postId, reason string) (int, error) {
	ids, err := deployed.Client.AdBoost.Query().Where(adboost.PostID(postId), adboost.StatusIn(cancellableBoostStatuses...)).IDs(ctx)
	if err != nil {
		return 0, err
	}
	for _, boostId := range ids {
		if _, err := CancelBoost(ctx, deployed, boostId, reason); err != nil {
			return 0, err
		}
	}
	return len(ids), nil
}

func CancelBoost(ctx context.Context, deployed *container.Container, boostId uuid.UUID, reason string) (*ent.AdBoost, error) {
	var cancelled *ent.AdBoost
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		boost, err := tx.AdBoost.Query().Where(adboost.ID(boostId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		cancelled = boost
		if !isCancellable(boost.Status) {
			return nil
		}
		funded := boost.Status != adboost.StatusPendingPayment
		spentMinor, delivered, err := boostSpend(ctx, tx, boost.CampaignID)
		if err != nil {
			return err
		}
		if err := stopBoostDelivery(ctx, tx, boost.CampaignID); err != nil {
			return err
		}
		unspent := int64(0)
		if funded {
			unspent = max(boost.TotalBudgetMinor-spentMinor, 0)
		}
		refund, restored, err := settleUnspentBudget(ctx, tx, boost, unspent, delivered)
		if err != nil {
			return err
		}
		if cancelled, err = tx.AdBoost.UpdateOneID(boost.ID).SetStatus(adboost.StatusCancelled).SetEndsAt(deployed.Now()).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdBoostCancelled, boost.ID.String(), deployed.Now(), events.AdBoostCancelledEventData{
			BoostId: boost.ID.String(), UserId: boost.UserID.String(), PostId: boost.PostID, Reason: reason, PaymentMethod: string(boost.PaymentMethod),
			Currency: boost.Currency, RefundMinor: refund, DebitIdempotencyKey: boost.IdempotencyKey, AllowanceRestored: restored,
		})
	})
	return cancelled, err
}

func isCancellable(status adboost.Status) bool {
	for _, candidate := range cancellableBoostStatuses {
		if status == candidate {
			return true
		}
	}
	return false
}

func boostSpend(ctx context.Context, tx *ent.Tx, campaignId uuid.UUID) (int64, bool, error) {
	var rows []struct {
		Micros int64 `json:"sum"`
		Count  int   `json:"count"`
	}
	err := tx.AdImpression.Query().Where(adimpression.CampaignID(campaignId), adimpression.ChargeMicrosGT(0)).
		Aggregate(ent.As(ent.Sum(adimpression.FieldChargeMicros), "sum"), ent.As(ent.Count(), "count")).Scan(ctx, &rows)
	if err != nil || len(rows) == 0 {
		return 0, false, err
	}
	micros := rows[0].Micros
	return (micros + types.MicrosPerMinorUnit - 1) / types.MicrosPerMinorUnit, rows[0].Count > 0, nil
}

func stopBoostDelivery(ctx context.Context, tx *ent.Tx, campaignId uuid.UUID) error {
	if err := tx.Ad.Update().Where(ad.CampaignID(campaignId), ad.StatusNEQ(ad.StatusCompleted)).SetStatus(ad.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	if err := tx.AdGroup.Update().Where(adgroup.CampaignID(campaignId), adgroup.StatusNEQ(adgroup.StatusCompleted)).SetStatus(adgroup.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	return tx.AdCampaign.UpdateOneID(campaignId).SetStatus(adcampaign.StatusCompleted).Exec(ctx)
}

func settleUnspentBudget(ctx context.Context, tx *ent.Tx, boost *ent.AdBoost, unspent int64, delivered bool) (int64, bool, error) {
	restored := false
	if boost.PaymentMethod == adboost.PaymentMethodFree && !delivered {
		removed, err := tx.AdFreeBoostGrant.Delete().Where(adfreeboostgrant.BoostID(boost.ID)).Exec(ctx)
		if err != nil {
			return 0, false, err
		}
		restored = removed > 0
	}
	if unspent <= 0 || boost.PaymentMethod == adboost.PaymentMethodCard {
		return 0, restored, nil
	}
	account, err := tx.AdAccount.Get(ctx, boost.AccountID)
	if err != nil {
		return 0, false, err
	}
	withdrawn := min(unspent, max(account.BalanceMinor, 0))
	if withdrawn <= 0 {
		return 0, restored, nil
	}
	if err := tx.AdAccount.UpdateOneID(account.ID).AddBalanceMinor(-withdrawn).Exec(ctx); err != nil {
		return 0, false, err
	}
	description := "Unspent boost budget returned"
	if boost.PaymentMethod == adboost.PaymentMethodFree {
		description = "Unspent free boost budget withdrawn"
	}
	if err := tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType("refund").SetAmountMinor(-withdrawn).SetCurrency(boost.Currency).
		SetDescription(description).SetReference("boostCancel:" + boost.ID.String()).Exec(ctx); err != nil {
		return 0, false, err
	}
	if boost.PaymentMethod == adboost.PaymentMethodFree {
		return 0, restored, nil
	}
	return withdrawn, restored, nil
}

func HandleBoostCancelledEvent(ctx context.Context, deployed *container.Container, envelope platformevents.EventEnvelope) error {
	var data events.AdBoostCancelledEventData
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data.BoostId == "" {
		return fmt.Errorf("%w: adBoost.cancelled data is malformed", platformevents.ErrPoisonMessage)
	}
	if data.RefundMinor <= 0 || (data.PaymentMethod != "wallet" && data.PaymentMethod != "balance") {
		return nil
	}
	return deployed.Funding.RefundBoostCharge(ctx, data.UserId, data.Currency, data.RefundMinor, "boost-cancel-"+data.BoostId, data.DebitIdempotencyKey)
}

func ReleaseFreeBoostBudgetInTransaction(ctx context.Context, tx *ent.Tx, boost *ent.AdBoost) error {
	if boost.PaymentMethod != adboost.PaymentMethodFree {
		return nil
	}
	spentMinor, delivered, err := boostSpend(ctx, tx, boost.CampaignID)
	if err != nil {
		return err
	}
	_, _, err = settleUnspentBudget(ctx, tx, boost, max(boost.TotalBudgetMinor-spentMinor, 0), delivered)
	return err
}
