package upsertcontentsignal

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, signal types.ContentSignal) error {
	optedIn, topics := signal.OptedInPlacements, signal.Topics
	if optedIn == nil {
		optedIn = []string{}
	}
	if topics == nil {
		topics = []string{}
	}
	return handler.Container.Client.AdContentSignal.Create().
		SetContentID(signal.ContentId).SetCreatorUserID(signal.CreatorUserId).SetContentKind(signal.ContentKind).SetDurationSeconds(signal.DurationSeconds).
		SetBrandSafe(signal.BrandSafe).SetSensitive(signal.Sensitive).SetKidsContent(signal.KidsContent).SetAiGenerated(signal.AiGenerated).
		SetMonetizationEligible(signal.MonetizationEligible).SetOptedInPlacements(optedIn).SetTopics(topics).SetUpdatedAt(handler.Container.Now()).
		OnConflictColumns("content_id").UpdateNewValues().Exec(ctx)
}
