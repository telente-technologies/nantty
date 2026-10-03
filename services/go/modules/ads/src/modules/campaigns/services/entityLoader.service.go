package services

import (
	"context"
	"time"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent/adcampaign"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	adsservices "zudomart/modules/ads/src/services"
)

type Loader struct {
	Client *ent.Client
	Now    func() time.Time
}

func (loader Loader) Window(account *ent.AdAccount, from, to string) DeliveryWindow {
	return DeliveryWindow{From: from, To: to, Today: adsservices.DayKeyInTimezone(loader.Now(), account.Timezone)}
}

func (loader Loader) PresentCampaigns(ctx context.Context, account *ent.AdAccount, campaigns []*ent.AdCampaign, window DeliveryWindow) ([]dtos.Campaign, error) {
	ids := make([]uuid.UUID, 0, len(campaigns))
	for _, campaign := range campaigns {
		ids = append(ids, campaign.ID)
	}
	delivery, err := LoadDelivery(ctx, loader.Client, "campaign", ids, window)
	if err != nil {
		return nil, err
	}
	groups, err := loader.Client.AdGroup.Query().Where(adgroup.CampaignIDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	ads, err := loader.Client.Ad.Query().Where(ad.CampaignIDIn(ids...)).Select(ad.FieldCampaignID, ad.FieldStatus).All(ctx)
	if err != nil {
		return nil, err
	}
	groupCounts, adCounts, rejectedCounts := map[uuid.UUID]int{}, map[uuid.UUID]int{}, map[uuid.UUID]int{}
	for _, group := range groups {
		groupCounts[group.CampaignID]++
	}
	for _, row := range ads {
		adCounts[row.CampaignID]++
		if row.Status == ad.StatusRejected {
			rejectedCounts[row.CampaignID]++
		}
	}
	presented := make([]dtos.Campaign, 0, len(campaigns))
	for _, campaign := range campaigns {
		summary := PresentDelivery(delivery[campaign.ID], string(campaign.Objective), account.Currency)
		presented = append(presented, PresentCampaign(campaign, account.Currency, groupCounts[campaign.ID], adCounts[campaign.ID], rejectedCounts[campaign.ID], summary))
	}
	return presented, nil
}

func (loader Loader) PresentAdSets(ctx context.Context, account *ent.AdAccount, groups []*ent.AdGroup, window DeliveryWindow) ([]dtos.AdSet, error) {
	ids := make([]uuid.UUID, 0, len(groups))
	campaignIds := make([]uuid.UUID, 0, len(groups))
	for _, group := range groups {
		ids, campaignIds = append(ids, group.ID), append(campaignIds, group.CampaignID)
	}
	delivery, err := LoadDelivery(ctx, loader.Client, "ad_group", ids, window)
	if err != nil {
		return nil, err
	}
	campaigns, err := loader.Client.AdCampaign.Query().Where(adcampaignIDIn(campaignIds)).Select("id", "objective").All(ctx)
	if err != nil {
		return nil, err
	}
	objectives := map[uuid.UUID]string{}
	for _, campaign := range campaigns {
		objectives[campaign.ID] = string(campaign.Objective)
	}
	ads, err := loader.Client.Ad.Query().Where(ad.AdGroupIDIn(ids...)).Select(ad.FieldAdGroupID).All(ctx)
	if err != nil {
		return nil, err
	}
	adCounts := map[uuid.UUID]int{}
	for _, row := range ads {
		adCounts[row.AdGroupID]++
	}
	presented := make([]dtos.AdSet, 0, len(groups))
	for _, group := range groups {
		presented = append(presented, PresentAdSet(group, account.Currency, adCounts[group.ID], PresentDelivery(delivery[group.ID], objectives[group.CampaignID], account.Currency)))
	}
	return presented, nil
}

func (loader Loader) PresentAds(ctx context.Context, account *ent.AdAccount, rows []*ent.Ad, window DeliveryWindow) ([]dtos.Ad, error) {
	ids := make([]uuid.UUID, 0, len(rows))
	campaignIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids, campaignIds = append(ids, row.ID), append(campaignIds, row.CampaignID)
	}
	delivery, err := LoadDelivery(ctx, loader.Client, "ad", ids, window)
	if err != nil {
		return nil, err
	}
	campaigns, err := loader.Client.AdCampaign.Query().Where(adcampaignIDIn(campaignIds)).Select("id", "objective").All(ctx)
	if err != nil {
		return nil, err
	}
	objectives := map[uuid.UUID]string{}
	for _, campaign := range campaigns {
		objectives[campaign.ID] = string(campaign.Objective)
	}
	presented := make([]dtos.Ad, 0, len(rows))
	for _, row := range rows {
		presented = append(presented, PresentAd(row, PresentDelivery(delivery[row.ID], objectives[row.CampaignID], account.Currency)))
	}
	return presented, nil
}

func LoadBundle(ctx context.Context, loader Loader, account *ent.AdAccount, campaignId string) (dtos.CampaignDraftResult, error) {
	id := uuid.MustParse(campaignId)
	campaign, err := loader.Client.AdCampaign.Get(ctx, id)
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	groups, err := loader.Client.AdGroup.Query().Where(adgroup.CampaignID(id)).All(ctx)
	if err != nil || len(groups) == 0 {
		return dtos.CampaignDraftResult{}, err
	}
	rows, err := loader.Client.Ad.Query().Where(ad.CampaignID(id)).Order(ent.Asc(ad.FieldCreatedAt)).All(ctx)
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	window := loader.Window(account, "", "")
	campaigns, err := loader.PresentCampaigns(ctx, account, []*ent.AdCampaign{campaign}, window)
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	adSets, err := loader.PresentAdSets(ctx, account, groups[:1], window)
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	ads, err := loader.PresentAds(ctx, account, rows, window)
	return dtos.CampaignDraftResult{Campaign: campaigns[0], AdSet: adSets[0], Ads: ads}, err
}

func (loader Loader) FindCampaign(ctx context.Context, accountId, campaignId uuid.UUID) (*ent.AdCampaign, error) {
	campaign, err := loader.Client.AdCampaign.Query().Where(adcampaign.ID(campaignId), adcampaign.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adserrors.NotFound
	}
	return campaign, err
}

func (loader Loader) FindAdSet(ctx context.Context, accountId, adSetId uuid.UUID) (*ent.AdGroup, error) {
	group, err := loader.Client.AdGroup.Query().Where(adgroup.ID(adSetId), adgroup.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adserrors.NotFound
	}
	return group, err
}

func (loader Loader) FindAd(ctx context.Context, accountId, adId uuid.UUID) (*ent.Ad, error) {
	row, err := loader.Client.Ad.Query().Where(ad.ID(adId), ad.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adserrors.NotFound
	}
	return row, err
}
