package recordadevents

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/adcardstatsdaily"
	"zudomart/modules/ads/src/modules/tracking/dtos"
	"zudomart/modules/ads/src/services"
)

const maximumCardIndex = 9

// recordCardView counts one view per impression and card; the counter key makes repeats from a swiping viewer no-ops.
func (handler Handler) recordCardView(ctx context.Context, claims services.AdTokenClaims, event dtos.AdEventDto) error {
	if event.CardIndex == nil || *event.CardIndex < 0 || *event.CardIndex > maximumCardIndex {
		return nil
	}
	seen, err := handler.Container.Counters.Increment(ctx, fmt.Sprintf("cv:%s:%d", claims.ImpressionId, *event.CardIndex), 1, 24*time.Hour)
	if err != nil || seen > 1 {
		return err
	}
	handler.bumpCardStats(ctx, claims, *event.CardIndex, 1, 0)
	return nil
}

func (handler Handler) bumpCardStats(ctx context.Context, claims services.AdTokenClaims, cardIndex int, impressions, clicks int64) {
	if cardIndex < 0 || cardIndex > maximumCardIndex {
		return
	}
	day := services.DayKeyInTimezone(handler.Container.Now(), claims.Timezone)
	err := handler.Container.Client.AdCardStatsDaily.Create().SetDay(day).SetAccountID(uuid.MustParse(claims.AccountId)).SetAdID(uuid.MustParse(claims.AdId)).
		SetCardIndex(cardIndex).SetImpressions(impressions).SetClicks(clicks).
		OnConflictColumns(adcardstatsdaily.FieldDay, adcardstatsdaily.FieldAdID, adcardstatsdaily.FieldCardIndex).
		AddImpressions(impressions).AddClicks(clicks).Exec(ctx)
	if err != nil {
		handler.Container.Logger.Warn("card stats update failed", "error", err)
	}
}
