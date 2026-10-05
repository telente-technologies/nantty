package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/platform/httpserver"
)

func ParseIdentifiers(raw []string, path string) ([]uuid.UUID, error) {
	parsed := make([]uuid.UUID, 0, len(raw))
	for _, value := range raw {
		id, err := uuid.Parse(value)
		if err != nil {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: "Some selected items are not in this ad account."}})
		}
		parsed = append(parsed, id)
	}
	return parsed, nil
}

func RequireTargetsInAccount(ctx context.Context, deployed *container.Container, accountId uuid.UUID, level string, raw []string) error {
	ids, err := ParseIdentifiers(raw, "targetIds")
	if err != nil {
		return err
	}
	var count int
	switch level {
	case "campaign":
		count, err = deployed.Client.AdCampaign.Query().Where(adcampaign.AccountID(accountId), adcampaign.IDIn(ids...)).Count(ctx)
	case "ad_set":
		count, err = deployed.Client.AdGroup.Query().Where(adgroup.AccountID(accountId), adgroup.IDIn(ids...)).Count(ctx)
	default:
		count, err = deployed.Client.Ad.Query().Where(ad.AccountID(accountId), ad.IDIn(ids...)).Count(ctx)
	}
	if err != nil {
		return err
	}
	if count != len(uniqueIdentifiers(ids)) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "targetIds", Message: "Some selected items are not in this ad account."}})
	}
	return nil
}

func uniqueIdentifiers(ids []uuid.UUID) map[uuid.UUID]bool {
	unique := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		unique[id] = true
	}
	return unique
}

func FindRule(ctx context.Context, client *ent.Client, accountId uuid.UUID, rawId string) (*ent.AdAutomatedRule, error) {
	id, err := uuid.Parse(rawId)
	if err != nil {
		return nil, nil
	}
	rule, err := client.AdAutomatedRule.Get(ctx, id)
	if ent.IsNotFound(err) || (err == nil && rule.AccountID != accountId) {
		return nil, nil
	}
	return rule, err
}
