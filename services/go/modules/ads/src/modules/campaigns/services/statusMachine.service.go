package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
)

func RequireStatusChangeAllowed(current, target string) error {
	if target != "active" && target != "paused" {
		return adserrors.StatusChangeNotAllowed
	}
	if current != "active" && current != "paused" {
		return adserrors.StatusChangeNotAllowed
	}
	return nil
}

func RequireFundsToRun(account *ent.AdAccount, now time.Time) error {
	if usableCredit(account, now)+account.BalanceMinor <= 0 {
		return adserrors.InsufficientBalance
	}
	return nil
}

func usableCredit(account *ent.AdAccount, now time.Time) int64 {
	if account.CreditExpiresAt != nil && !account.CreditExpiresAt.After(now) {
		return 0
	}
	return account.CreditMinor
}

func SubmitAdsForReviewInTransaction(ctx context.Context, tx *ent.Tx, campaignId uuid.UUID, now time.Time) (int, error) {
	pending, err := tx.Ad.Query().Where(ad.CampaignID(campaignId), ad.StatusIn(ad.StatusDraft, ad.StatusRejected)).All(ctx)
	if err != nil {
		return 0, err
	}
	for _, row := range pending {
		flags := RunAutomatedPolicyChecks(row.Creative.Input)
		if err := tx.Ad.UpdateOneID(row.ID).SetStatus(ad.StatusInReview).SetReviewStatus(ad.ReviewStatusPending).SetSubmittedAt(now).SetAutoCheckFlags(flags).Exec(ctx); err != nil {
			return 0, err
		}
	}
	if len(pending) == 0 {
		return 0, nil
	}
	return len(pending), RecomputeParentStatusesInTransaction(ctx, tx, campaignId)
}

func RecomputeParentStatusesInTransaction(ctx context.Context, tx *ent.Tx, campaignId uuid.UUID) error {
	groups, err := tx.AdGroup.Query().Where(adgroup.CampaignID(campaignId)).All(ctx)
	if err != nil {
		return err
	}
	groupStatuses := make([]string, 0, len(groups))
	for _, group := range groups {
		ads, err := tx.Ad.Query().Where(ad.AdGroupID(group.ID)).Select(ad.FieldStatus).All(ctx)
		if err != nil {
			return err
		}
		next := DeriveParentStatus(adStatuses(ads), string(group.Status))
		if next != string(group.Status) {
			if err := tx.AdGroup.UpdateOneID(group.ID).SetStatus(adgroup.Status(next)).Exec(ctx); err != nil {
				return err
			}
		}
		groupStatuses = append(groupStatuses, next)
	}
	campaign, err := tx.AdCampaign.Get(ctx, campaignId)
	if err != nil {
		return err
	}
	if next := DeriveParentStatus(groupStatuses, string(campaign.Status)); next != string(campaign.Status) {
		return tx.AdCampaign.UpdateOneID(campaignId).SetStatus(adcampaign.Status(next)).Exec(ctx)
	}
	return nil
}

func adStatuses(rows []*ent.Ad) []string {
	statuses := make([]string, 0, len(rows))
	for _, row := range rows {
		statuses = append(statuses, string(row.Status))
	}
	return statuses
}

func DeriveParentStatus(childStatuses []string, current string) string {
	if current == "paused" || current == "completed" || len(childStatuses) == 0 {
		return current
	}
	counts := map[string]int{}
	for _, status := range childStatuses {
		counts[status]++
	}
	switch {
	case counts["active"] > 0 || counts["paused"] > 0:
		return "active"
	case counts["in_review"] > 0:
		return "in_review"
	case counts["rejected"] == len(childStatuses):
		return "rejected"
	case counts["draft"] > 0:
		return "draft"
	}
	return current
}

func AccountHasRunnableFunds(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) error {
	account, err := client.AdAccount.Query().Where(adaccount.ID(accountId)).Only(ctx)
	if err != nil {
		return err
	}
	return RequireFundsToRun(account, now)
}
