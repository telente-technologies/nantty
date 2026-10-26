package services

import (
	"context"
	"slices"
	"time"

	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	reportevents "nantty/modules/moderation/src/modules/contentReports/events"
)

var visibilityOrder = []string{"visible", "restricted", "hidden", "removed"}

func VisibilityRank(visibility string) int {
	return slices.Index(visibilityOrder, visibility)
}

func PublishVisibilityChange(ctx context.Context, tx *ent.Tx, targetType, targetId, ownerId, visibility, source, referenceId, reason string, now time.Time) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, reportevents.ContentVisibilityChangedType, targetType+":"+targetId, now, reportevents.ContentVisibilityChangedData{
		TargetType: targetType, TargetId: targetId, OwnerId: ownerId, Visibility: visibility, Source: source, ReferenceId: referenceId, Reason: reason,
	})
}
