package services

import (
	"context"
	"encoding/json"
	"time"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/types"
)

const (
	AdvertiserAuditSubject = "ad_account"
	AdAuditSubject         = "ad"
)

func PresentAdvertisers(ctx context.Context, deployed *container.Container, rows []*ent.AdAccount) ([]dtos.Advertiser, error) {
	ownerIds := make([]string, 0, len(rows))
	for _, row := range rows {
		ownerIds = append(ownerIds, row.OwnerUserID.String())
	}
	owners, err := ownerSummaries(ctx, deployed, ownerIds)
	if err != nil {
		return nil, err
	}
	items := make([]dtos.Advertiser, 0, len(rows))
	for _, row := range rows {
		active, err := deployed.Client.AdCampaign.Query().Where(adcampaign.AccountID(row.ID), adcampaign.StatusEQ(adcampaign.StatusActive)).Count(ctx)
		if err != nil {
			return nil, err
		}
		advertiser := dtos.Advertiser{
			Id: row.ID.String(), Name: row.Name, Owner: owners[row.OwnerUserID.String()], Status: PresentAdvertiserRef(row).Status, Country: row.CountryCode, Currency: row.Currency,
			SpendByCurrency: []types.Money{{AmountMinor: row.AmountSpentMicros / types.MicrosPerMinorUnit, Currency: row.Currency}},
			ActiveCampaigns: active, ViolationCount: row.ViolationCount, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		}
		if row.LastViolationAt != nil {
			last := row.LastViolationAt.UTC().Format(time.RFC3339)
			advertiser.LastViolationAt = &last
		}
		items = append(items, advertiser)
	}
	return items, nil
}

func ownerSummaries(ctx context.Context, deployed *container.Container, ids []string) (map[string]json.RawMessage, error) {
	summaries, err := deployed.UserSummaries.LookupSummaries(ctx, ids)
	if err != nil {
		deployed.Logger.Warn("user summaries are unavailable; showing basic owner details", "error", err)
		summaries = map[string]json.RawMessage{}
	}
	missing := []string{}
	for _, id := range ids {
		if _, found := summaries[id]; !found {
			missing = append(missing, id)
		}
	}
	if len(missing) == 0 {
		return summaries, nil
	}
	basics, err := deployed.Users.LookupUsers(ctx, missing)
	if err != nil {
		return nil, err
	}
	for _, id := range missing {
		user := basics[id]
		encoded, _ := json.Marshal(map[string]any{
			"id": id, "username": user.Username, "displayName": user.Name, "avatarUrl": nil, "country": nil, "currency": nil, "status": "ACTIVE", "verification": nil,
			"isSeller": false, "isCreator": false, "followerCount": 0, "joinedAt": nil, "lastActiveAt": nil, "strikeCount": 0, "riskLevel": "LOW", "emailMasked": nil, "phoneMasked": nil,
		})
		summaries[id] = encoded
	}
	return summaries, nil
}

func ReadHistory(ctx context.Context, deployed *container.Container, subjectType, subjectId string) []json.RawMessage {
	history, err := deployed.AuditHistory.ListHistory(ctx, subjectType, subjectId)
	if err != nil {
		deployed.Logger.Warn("audit history is unavailable", "error", err)
		return []json.RawMessage{}
	}
	return history
}

func LoadAdvertiserDetail(ctx context.Context, deployed *container.Container, account *ent.AdAccount) (dtos.AdvertiserDetail, error) {
	presented, err := PresentAdvertisers(ctx, deployed, []*ent.AdAccount{account})
	if err != nil {
		return dtos.AdvertiserDetail{}, err
	}
	return dtos.AdvertiserDetail{Advertiser: presented[0], History: ReadHistory(ctx, deployed, AdvertiserAuditSubject, account.ID.String())}, nil
}
