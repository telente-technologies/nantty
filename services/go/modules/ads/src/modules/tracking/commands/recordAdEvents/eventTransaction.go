package recordadevents

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adimpression"
	"zudomart/modules/ads/src/modules/tracking/dtos"
	"zudomart/modules/ads/src/services"
)

func (handler Handler) applyInTransaction(ctx context.Context, claims services.AdTokenClaims, event dtos.AdEventDto, verdict services.FraudVerdict) (services.EventEffects, bool, error) {
	var effects services.EventEffects
	var duplicate bool
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		impressionId, err := uuid.Parse(claims.ImpressionId)
		if err != nil {
			return err
		}
		if err := insertImpressionRowWhenMissing(ctx, tx, claims, impressionId); err != nil {
			return err
		}
		row, err := tx.AdImpression.Query().Where(adimpression.ID(impressionId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		before := stateFromRow(row)
		after, applied := services.ApplyAdEventToImpression(before, claims, services.AdEventInput{Kind: event.Type, WatchMs: event.WatchMs, VisiblePercent: event.VisiblePercent, Verdict: verdict})
		effects = applied
		duplicate = after == before
		if duplicate {
			return nil
		}
		return handler.persistChange(ctx, tx, row, claims, after, applied, verdict)
	})
	return effects, duplicate, err
}

func insertImpressionRowWhenMissing(ctx context.Context, tx *ent.Tx, claims services.AdTokenClaims, impressionId uuid.UUID) error {
	create := tx.AdImpression.Create().SetID(impressionId).SetServedAt(time.Unix(claims.IssuedAtUnix, 0).UTC()).
		SetAdID(uuid.MustParse(claims.AdId)).SetAdGroupID(uuid.MustParse(claims.AdGroupId)).SetCampaignID(uuid.MustParse(claims.CampaignId)).SetAccountID(uuid.MustParse(claims.AccountId)).
		SetUserID(claims.UserId).SetSessionID(claims.SessionId).SetPlacement(claims.Placement).SetSlotKind(claims.SlotKind).SetContentID(claims.ContentId).
		SetCreatorUserID(claims.CreatorUserId).SetCountry(claims.Country).SetRegion(claims.Region).SetAgeBand(claims.AgeBand).SetGender(claims.Gender).SetAiGenerated(claims.AiGenerated).
		SetCurrency(claims.Currency).SetBasis(adimpression.Basis(claims.Basis)).SetPriceMicros(claims.PriceMicros).SetPctrPpm(claims.PctrPpm).
		SetCreatorShareBps(claims.CreatorShareBps).SetCreatorMultiplierBps(claims.MultiplierBps)
	err := create.OnConflictColumns(adimpression.FieldID).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}

func stateFromRow(row *ent.AdImpression) services.ImpressionState {
	return services.ImpressionState{
		Viewed: row.ViewedAt != nil, WatchMs: row.WatchMs, Completed: row.Completed, ClickCount: row.ClickCount, Qualified: row.Qualified,
		FraudStatus: string(row.FraudStatus), Charged: row.ChargeMicros > 0,
	}
}

func (handler Handler) persistChange(ctx context.Context, tx *ent.Tx, row *ent.AdImpression, claims services.AdTokenClaims, after services.ImpressionState, effects services.EventEffects, verdict services.FraudVerdict) error {
	now := handler.Container.Now()
	update := tx.AdImpression.UpdateOneID(row.ID).SetWatchMs(after.WatchMs).SetCompleted(after.Completed).SetClickCount(after.ClickCount).SetQualified(after.Qualified).
		SetFraudStatus(adimpression.FraudStatus(after.FraudStatus)).SetFraudScore(verdict.Score)
	if verdict.Reason != "" && effects.InvalidReason != "" {
		update.SetFraudReason(effects.InvalidReason)
	}
	if effects.CountImpression {
		update.SetViewedAt(now)
	}
	if effects.CountClick {
		update.SetClickedAt(now)
	}
	if effects.NowQualified {
		update.SetQualifiedAt(now)
	}
	if effects.Charge.ChargeMicros > 0 {
		update.SetChargeMicros(effects.Charge.ChargeMicros).SetCreatorShareMicros(effects.Charge.CreatorMicros).SetPlatformShareMicros(effects.Charge.PlatformMicros)
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	if err := upsertDailyStats(ctx, tx, claims, effects, services.DayKeyInTimezone(now, claims.Timezone)); err != nil {
		return err
	}
	if !effects.NowQualified {
		return nil
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdImpressionRecorded, claims.ImpressionId, now, events.AdImpressionRecordedEventData{
		ImpressionId: claims.ImpressionId, AdId: claims.AdId, CampaignId: claims.CampaignId, AccountId: claims.AccountId, UserId: claims.UserId, Placement: claims.Placement,
		SlotKind: claims.SlotKind, ContentId: claims.ContentId, CreatorUserId: claims.CreatorUserId, Country: claims.Country, AiGenerated: claims.AiGenerated,
		WatchMs: after.WatchMs, Completed: after.Completed, Clicked: after.ClickCount > 0, FraudScore: verdict.Score, Currency: claims.Currency,
		ChargeMicros: effects.Charge.ChargeMicros, QualifiedAt: now,
	})
}
