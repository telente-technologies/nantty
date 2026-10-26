package integrations

import (
	"context"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcontentsignal"
	"nantty/modules/ads/src/types"
)

type EntContentSignalReader struct{ Client *ent.Client }

func (reader EntContentSignalReader) FindContentSignal(ctx context.Context, contentId string) (types.ContentSignal, bool, error) {
	row, err := reader.Client.AdContentSignal.Query().Where(adcontentsignal.ContentID(contentId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.ContentSignal{}, false, nil
	}
	if err != nil {
		return types.ContentSignal{}, false, err
	}
	return types.ContentSignal{
		ContentId: row.ContentID, CreatorUserId: row.CreatorUserID, ContentKind: row.ContentKind, DurationSeconds: row.DurationSeconds,
		BrandSafe: row.BrandSafe, Sensitive: row.Sensitive, KidsContent: row.KidsContent, AiGenerated: row.AiGenerated,
		MonetizationEligible: row.MonetizationEligible, Removed: row.Removed, OptedInPlacements: row.OptedInPlacements, Topics: row.Topics,
	}, true, nil
}
