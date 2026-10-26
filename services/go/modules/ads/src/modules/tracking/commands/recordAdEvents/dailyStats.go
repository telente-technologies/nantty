package recordadevents

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adstatsdaily"
	"nantty/modules/ads/src/services"
)

func upsertDailyStats(ctx context.Context, tx *ent.Tx, claims services.AdTokenClaims, effects services.EventEffects, day string) error {
	impressions, qualified, reach, clicks, views := int64(0), int64(0), int64(0), int64(0), int64(0)
	if effects.CountImpression {
		impressions = 1
		if claims.NewReachToday {
			reach = 1
		}
	}
	if effects.NowQualified {
		qualified = 1
	}
	if effects.CountClick {
		clicks = 1
	}
	if effects.CountVideoView {
		views = 1
	}
	if impressions+qualified+clicks+views+int64(effects.WatchMsDelta)+effects.Charge.ChargeMicros == 0 {
		return nil
	}
	return tx.AdStatsDaily.Create().
		SetDay(day).SetAccountID(uuid.MustParse(claims.AccountId)).SetCampaignID(uuid.MustParse(claims.CampaignId)).SetAdGroupID(uuid.MustParse(claims.AdGroupId)).SetAdID(uuid.MustParse(claims.AdId)).
		SetPlacement(claims.Placement).SetCountry(claims.Country).SetRegion(claims.Region).SetAgeBand(claims.AgeBand).SetGender(claims.Gender).
		SetImpressions(impressions).SetQualifiedImpressions(qualified).SetReach(reach).SetClicks(clicks).SetSpendMicros(effects.Charge.ChargeMicros).
		SetVideoViews(views).SetWatchMsTotal(int64(effects.WatchMsDelta)).
		OnConflictColumns(adstatsdaily.FieldDay, adstatsdaily.FieldAdID, adstatsdaily.FieldPlacement, adstatsdaily.FieldCountry, adstatsdaily.FieldRegion, adstatsdaily.FieldAgeBand, adstatsdaily.FieldGender).
		AddImpressions(impressions).AddQualifiedImpressions(qualified).AddReach(reach).AddClicks(clicks).AddSpendMicros(effects.Charge.ChargeMicros).AddVideoViews(views).AddWatchMsTotal(int64(effects.WatchMsDelta)).Exec(ctx)
}
