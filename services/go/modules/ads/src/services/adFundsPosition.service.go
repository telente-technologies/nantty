package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/adimpression"
	"nantty/modules/ads/src/types"
)

const WithdrawalSettlementWait = 24 * time.Hour

var LiveBoostStatuses = []adboost.Status{adboost.StatusInReview, adboost.StatusActive, adboost.StatusPaused}

type AdFundsPosition struct {
	BalanceMinor           int64
	CreditMinor            int64
	CommittedMinor         int64
	SpendableMinor         int64
	WithdrawableMinor      int64
	PendingSettlementMinor int64
}

func CampaignSpendMinor(ctx context.Context, client *ent.Client, campaignIds []uuid.UUID) (map[uuid.UUID]int64, error) {
	spent := make(map[uuid.UUID]int64, len(campaignIds))
	if len(campaignIds) == 0 {
		return spent, nil
	}
	var rows []struct {
		CampaignId uuid.UUID `json:"campaign_id"`
		Micros     int64     `json:"sum"`
	}
	err := client.AdImpression.Query().Where(adimpression.CampaignIDIn(campaignIds...), adimpression.ChargeMicrosGT(0)).
		GroupBy(adimpression.FieldCampaignID).Aggregate(ent.As(ent.Sum(adimpression.FieldChargeMicros), "sum")).Scan(ctx, &rows)
	for _, row := range rows {
		spent[row.CampaignId] = (row.Micros + types.MicrosPerMinorUnit - 1) / types.MicrosPerMinorUnit
	}
	return spent, err
}

func CommittedBoostBudgetMinor(ctx context.Context, client *ent.Client, accountId uuid.UUID, excludedBoostId *uuid.UUID) (int64, error) {
	query := client.AdBoost.Query().Where(adboost.AccountID(accountId), adboost.StatusIn(LiveBoostStatuses...))
	if excludedBoostId != nil {
		query.Where(adboost.IDNEQ(*excludedBoostId))
	}
	live, err := query.All(ctx)
	if err != nil || len(live) == 0 {
		return 0, err
	}
	campaignIds := make([]uuid.UUID, 0, len(live))
	for _, boost := range live {
		campaignIds = append(campaignIds, boost.CampaignID)
	}
	spent, err := CampaignSpendMinor(ctx, client, campaignIds)
	if err != nil {
		return 0, err
	}
	committed := int64(0)
	for _, boost := range live {
		committed += max(boost.TotalBudgetMinor-spent[boost.CampaignID], 0)
	}
	return committed, nil
}

func ReadAdFundsPosition(ctx context.Context, client *ent.Client, account *ent.AdAccount, now time.Time) (AdFundsPosition, error) {
	credit, err := SpendableCreditMinor(ctx, client, account.ID, now)
	if err != nil {
		return AdFundsPosition{}, err
	}
	credit = min(credit, max(account.CreditMinor, 0))
	committed, err := CommittedBoostBudgetMinor(ctx, client, account.ID, nil)
	if err != nil {
		return AdFundsPosition{}, err
	}
	var recent []struct {
		Sum int64 `json:"sum"`
	}
	err = client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(account.ID), adfundstransaction.TypeEQ(adfundstransaction.TypeTopUp),
		adfundstransaction.AmountMinorGT(0), adfundstransaction.CreatedAtGT(now.Add(-WithdrawalSettlementWait))).
		Aggregate(ent.As(ent.Sum(adfundstransaction.FieldAmountMinor), "sum")).Scan(ctx, &recent)
	if err != nil {
		return AdFundsPosition{}, err
	}
	pending := int64(0)
	if len(recent) > 0 {
		pending = recent[0].Sum
	}
	balance := max(account.BalanceMinor, 0)
	reservedFromBalance := max(committed-credit, 0)
	return AdFundsPosition{
		BalanceMinor: balance, CreditMinor: credit, CommittedMinor: committed, SpendableMinor: max(balance+credit-committed, 0),
		WithdrawableMinor: max(balance-reservedFromBalance-pending, 0), PendingSettlementMinor: min(pending, balance),
	}, nil
}
