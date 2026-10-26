package services

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
	"nantty/modules/ads/src/generated/ent/adstatsdaily"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/types"
)

const candidateLoadLimit = 5_000

type CandidateIndex struct {
	Client       *ent.Client
	Spend        SpendCounters
	Now          func() time.Time
	Refresh      time.Duration
	Destinations interfaces.PromotedDestinationDirectory
	Logger       *slog.Logger
	mutex        sync.RWMutex
	snapshot     []types.CandidateAd
	loadedAt     time.Time
}

func (index *CandidateIndex) Snapshot(ctx context.Context) ([]types.CandidateAd, error) {
	index.mutex.RLock()
	fresh := !index.loadedAt.IsZero() && index.Now().Sub(index.loadedAt) < 3*index.Refresh
	snapshot := index.snapshot
	index.mutex.RUnlock()
	if fresh {
		return snapshot, nil
	}
	if err := index.ReloadFromDatabase(ctx); err != nil {
		return nil, err
	}
	index.mutex.RLock()
	defer index.mutex.RUnlock()
	return index.snapshot, nil
}

func (index *CandidateIndex) ReloadFromDatabase(ctx context.Context) error {
	now := index.Now()
	ads, err := index.Client.Ad.Query().Where(ad.StatusEQ(ad.StatusActive), ad.ReviewStatusEQ(ad.ReviewStatusApproved)).Limit(candidateLoadLimit).All(ctx)
	if err != nil {
		return err
	}
	groups, campaigns, accounts, err := index.loadParents(ctx, ads)
	if err != nil {
		return err
	}
	history, err := index.loadHistory(ctx, ads)
	if err != nil {
		return err
	}
	experimentSlices, err := index.loadExperimentSlices(ctx, groups)
	if err != nil {
		return err
	}
	candidates := make([]types.CandidateAd, 0, len(ads))
	for _, row := range ads {
		group, groupFound := groups[row.AdGroupID]
		campaign, campaignFound := campaigns[row.CampaignID]
		account, accountFound := accounts[row.AccountID]
		if !groupFound || !campaignFound || !accountFound || !windowIsOpen(now, group.StartAt, group.EndAt) || !windowIsOpen(now, campaign.StartAt, campaign.EndAt) {
			continue
		}
		candidate := buildCandidate(row, group, campaign, account, history[row.ID])
		applyExperimentSlice(&candidate, experimentSlices)
		candidates = append(candidates, candidate)
	}
	candidates = ApplyPromotedDestinations(ctx, index.Destinations, index.Logger, candidates)
	index.seedSpendCounters(ctx, candidates)
	index.mutex.Lock()
	index.snapshot, index.loadedAt = candidates, now
	index.mutex.Unlock()
	return nil
}

func windowIsOpen(now, start time.Time, end *time.Time) bool {
	return !start.After(now) && (end == nil || end.After(now))
}

type adHistory struct{ impressions, clicks int64 }

func (index *CandidateIndex) loadParents(ctx context.Context, ads []*ent.Ad) (map[uuid.UUID]*ent.AdGroup, map[uuid.UUID]*ent.AdCampaign, map[uuid.UUID]*ent.AdAccount, error) {
	groupIds, campaignIds, accountIds := make([]uuid.UUID, 0, len(ads)), make([]uuid.UUID, 0, len(ads)), make([]uuid.UUID, 0, len(ads))
	for _, row := range ads {
		groupIds, campaignIds, accountIds = append(groupIds, row.AdGroupID), append(campaignIds, row.CampaignID), append(accountIds, row.AccountID)
	}
	groups, err := index.Client.AdGroup.Query().Where(adgroup.IDIn(groupIds...), adgroup.StatusEQ(adgroup.StatusActive)).All(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	campaigns, err := index.Client.AdCampaign.Query().Where(adcampaign.IDIn(campaignIds...), adcampaign.StatusEQ(adcampaign.StatusActive)).All(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	accounts, err := index.Client.AdAccount.Query().Where(adaccount.IDIn(accountIds...), adaccount.StatusEQ(adaccount.StatusActive)).All(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	groupMap, campaignMap, accountMap := map[uuid.UUID]*ent.AdGroup{}, map[uuid.UUID]*ent.AdCampaign{}, map[uuid.UUID]*ent.AdAccount{}
	for _, row := range groups {
		groupMap[row.ID] = row
	}
	for _, row := range campaigns {
		campaignMap[row.ID] = row
	}
	for _, row := range accounts {
		accountMap[row.ID] = row
	}
	return groupMap, campaignMap, accountMap, nil
}

func (index *CandidateIndex) loadHistory(ctx context.Context, ads []*ent.Ad) (map[uuid.UUID]adHistory, error) {
	ids := make([]uuid.UUID, 0, len(ads))
	for _, row := range ads {
		ids = append(ids, row.ID)
	}
	var rows []struct {
		AdId        uuid.UUID `json:"ad_id"`
		Impressions int64     `json:"sum_impressions"`
		Clicks      int64     `json:"sum_clicks"`
	}
	err := index.Client.AdStatsDaily.Query().Where(adstatsdaily.AdIDIn(ids...)).GroupBy(adstatsdaily.FieldAdID).
		Aggregate(sumAs("impressions", adstatsdaily.FieldImpressions), sumAs("clicks", adstatsdaily.FieldClicks)).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}
	history := map[uuid.UUID]adHistory{}
	for _, row := range rows {
		history[row.AdId] = adHistory{impressions: row.Impressions, clicks: row.Clicks}
	}
	return history, nil
}

func (index *CandidateIndex) seedSpendCounters(ctx context.Context, candidates []types.CandidateAd) {
	days := []string{index.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"), index.Now().UTC().Format("2006-01-02"), index.Now().UTC().AddDate(0, 0, 1).Format("2006-01-02")}
	var rows []struct {
		AdGroupId  uuid.UUID `json:"ad_group_id"`
		CampaignId uuid.UUID `json:"campaign_id"`
		Day        string    `json:"day"`
		Spend      int64     `json:"sum_spend"`
	}
	err := index.Client.AdStatsDaily.Query().Where(adstatsdaily.DayIn(days...)).GroupBy(adstatsdaily.FieldAdGroupID, adstatsdaily.FieldCampaignID, adstatsdaily.FieldDay).
		Aggregate(sumAs("spend", adstatsdaily.FieldSpendMicros)).Scan(ctx, &rows)
	if err != nil {
		return
	}
	for _, row := range rows {
		_ = index.Spend.SeedAtLeast(ctx, "g", row.AdGroupId.String(), row.Day, row.Spend, 3*24*time.Hour)
		_ = index.Spend.SeedAtLeast(ctx, "c", row.CampaignId.String(), row.Day, row.Spend, 3*24*time.Hour)
	}
}

func buildCandidate(row *ent.Ad, group *ent.AdGroup, campaign *ent.AdCampaign, account *ent.AdAccount, history adHistory) types.CandidateAd {
	candidate := types.CandidateAd{
		AdId: row.ID.String(), AdGroupId: group.ID.String(), CampaignId: campaign.ID.String(), CampaignKind: string(campaign.Kind), AccountId: account.ID.String(),
		Format: row.Format, Creative: row.Creative.Resolved, Audience: group.Audience, Placements: resolvePlacements(group),
		BidType: string(group.BidType), StartAt: group.StartAt, EndAt: group.EndAt, Currency: account.Currency, Timezone: account.Timezone,
		BalanceFundsMicros: account.BalanceMinor * types.MicrosPerMinorUnit, CreditFundsMicros: account.CreditMinor * types.MicrosPerMinorUnit, CreditExpiresAt: account.CreditExpiresAt,
		MonthlySpendLimit: account.SpendLimitMinor, HistoricalImpressions: history.impressions, HistoricalClicks: history.clicks,
		VideoDurationSeconds: videoDurationSeconds(row.Creative.Resolved), AgeRestricted: IsAgeRestrictedAd(row, campaign),
	}
	if group.BidAmountMinor != nil {
		candidate.BidMinor = *group.BidAmountMinor
	}
	if group.BudgetType != nil && group.BudgetAmountMinor != nil {
		candidate.GroupBudgetType, candidate.GroupBudgetMicros = string(*group.BudgetType), *group.BudgetAmountMinor*types.MicrosPerMinorUnit
	}
	if campaign.BudgetType != nil && campaign.BudgetAmountMinor != nil {
		candidate.CampaignBudgetType, candidate.CampaignBudgetMicros = string(*campaign.BudgetType), *campaign.BudgetAmountMinor*types.MicrosPerMinorUnit
	}
	if campaign.SpendCapMinor != nil {
		candidate.SpendCapMicros = *campaign.SpendCapMinor * types.MicrosPerMinorUnit
	}
	if group.FrequencyCapImpressions != nil && group.FrequencyCapPerDays != nil {
		candidate.FrequencyImpressions, candidate.FrequencyPerDays = *group.FrequencyCapImpressions, *group.FrequencyCapPerDays
	}
	return candidate
}

func resolvePlacements(group *ent.AdGroup) []string {
	if group.PlacementMode == adgroup.PlacementModeManual && len(group.Placements) > 0 {
		return group.Placements
	}
	return AllAdvertiserPlacements
}

func videoDurationSeconds(creative types.Creative) int {
	for _, media := range creative.Media {
		if media.Kind == "video" && media.DurationSeconds != nil {
			return *media.DurationSeconds
		}
	}
	return 0
}
