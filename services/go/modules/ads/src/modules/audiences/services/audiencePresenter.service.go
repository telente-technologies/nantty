package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/modules/audiences/dtos"
)

func PresentAudience(row *ent.AdCustomAudience, usedInAdSets int) dtos.CustomAudience {
	audience := dtos.CustomAudience{
		Id: row.ID.String(), AccountId: row.AccountID.String(), Name: row.Name, Type: string(row.Type), Status: string(row.Status), RetentionDays: row.RetentionDays,
		Description: row.Description, UsedInAdSetCount: usedInAdSets, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if row.Status == "ready" || row.Status == "too_small" {
		lower, upper := RoundToRange(row.MatchedCount)
		audience.ApproximateSize = &dtos.NumberRange{Lower: lower, Upper: upper}
	}
	if row.LookalikeSourceID != nil {
		audience.Lookalike = &dtos.Lookalike{SourceAudienceId: row.LookalikeSourceID.String(), CountryCode: row.LookalikeCountryCode, SimilarityPercent: row.LookalikeSimilarityPercent}
	}
	return audience
}

// CountAdSetsUsing counts ad sets that include or exclude the audience.
func CountAdSetsUsing(ctx context.Context, deployed *container.Container, accountId, audienceId uuid.UUID) int {
	var count int
	err := deployed.Database.QueryRowContext(ctx, `SELECT count(*) FROM ad_groups WHERE account_id = $1 AND status <> 'completed' AND (audience->'customAudienceIds' @> to_jsonb($2::text) OR audience->'excludedCustomAudienceIds' @> to_jsonb($2::text))`, accountId, audienceId.String()).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}
