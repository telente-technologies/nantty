package services

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adconversionevent"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/types"
	"nantty/platform/httpserver"
)

const maximumCustomAudiences = 25

func RequireUsableAccountReferences(ctx context.Context, client *ent.Client, accountId uuid.UUID, input dtos.AdSetInput, prefix string) error {
	issues, err := customAudienceIssues(ctx, client, accountId, input.Audience, prefix+"audience.")
	if err != nil {
		return err
	}
	if input.ConversionEventId != nil && *input.ConversionEventId != "" {
		known, err := conversionEventBelongsToAccount(ctx, client, accountId, *input.ConversionEventId)
		if err != nil {
			return err
		}
		if !known {
			issues = append(issues, httpserver.ValidationIssue{Path: prefix + "conversionEventId", Message: "Choose a conversion event from this ad account."})
		}
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func customAudienceIssues(ctx context.Context, client *ent.Client, accountId uuid.UUID, audience types.AudienceSpec, prefix string) ([]httpserver.ValidationIssue, error) {
	var issues []httpserver.ValidationIssue
	lists := map[string][]string{"customAudienceIds": audience.CustomAudienceIds, "excludedCustomAudienceIds": audience.ExcludedCustomAudienceIds}
	for _, field := range []string{"customAudienceIds", "excludedCustomAudienceIds"} {
		ids := lists[field]
		if len(ids) == 0 {
			continue
		}
		if len(ids) > maximumCustomAudiences {
			issues = append(issues, httpserver.ValidationIssue{Path: prefix + field, Message: fmt.Sprintf("Choose at most %d custom audiences.", maximumCustomAudiences)})
			continue
		}
		message, err := firstUnusableAudience(ctx, client, accountId, ids)
		if err != nil {
			return nil, err
		}
		if message != "" {
			issues = append(issues, httpserver.ValidationIssue{Path: prefix + field, Message: message})
		}
	}
	for _, id := range audience.CustomAudienceIds {
		if slices.Contains(audience.ExcludedCustomAudienceIds, id) {
			issues = append(issues, httpserver.ValidationIssue{Path: prefix + "excludedCustomAudienceIds", Message: "An audience cannot be both included and excluded."})
			break
		}
	}
	return issues, nil
}

func firstUnusableAudience(ctx context.Context, client *ent.Client, accountId uuid.UUID, ids []string) (string, error) {
	parsed := make([]uuid.UUID, 0, len(ids))
	for _, raw := range ids {
		id, err := uuid.Parse(raw)
		if err != nil {
			return "Some selected audiences are not in this ad account.", nil
		}
		parsed = append(parsed, id)
	}
	rows, err := client.AdCustomAudience.Query().Where(adcustomaudience.AccountID(accountId), adcustomaudience.IDIn(parsed...)).All(ctx)
	if err != nil {
		return "", err
	}
	found := make(map[uuid.UUID]*ent.AdCustomAudience, len(rows))
	for _, row := range rows {
		found[row.ID] = row
	}
	for _, id := range parsed {
		row, known := found[id]
		switch {
		case !known:
			return "Some selected audiences are not in this ad account.", nil
		case row.Status == adcustomaudience.StatusTooSmall:
			return fmt.Sprintf("%q is too small to target. Choose a larger audience.", row.Name), nil
		case row.Status != adcustomaudience.StatusReady:
			return fmt.Sprintf("%q is not ready yet. Try again when it has finished building.", row.Name), nil
		}
	}
	return "", nil
}

func conversionEventBelongsToAccount(ctx context.Context, client *ent.Client, accountId uuid.UUID, raw string) (bool, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return false, nil
	}
	return client.AdConversionEvent.Query().Where(adconversionevent.ID(id), adconversionevent.AccountID(accountId), adconversionevent.StatusNEQ(adconversionevent.StatusPaused)).Exist(ctx)
}
