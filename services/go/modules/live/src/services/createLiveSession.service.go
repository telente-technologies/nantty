package services

import (
	"context"
	"slices"
	"strings"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/databases/schema"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
)

var liveAdPlacements = []string{"beforeJoin", "naturalBreak", "betweenSegments", "overlay", "end"}

func (service *LiveService) buildLiveAdSettingsRecord(input types.LiveMonetizationInput) (map[string]any, *string, error) {
	if input.LiveAdSettings == nil {
		return nil, nil, nil
	}
	settings := input.LiveAdSettings
	if settings.AllowAds && input.AcceptedLiveAdTermsVersion == "" {
		return nil, nil, liveerrors.LiveAdTermsRequired
	}
	if input.AcceptedLiveAdTermsVersion != "" && input.AcceptedLiveAdTermsVersion != service.Settings.LiveAdTermsCurrentVersion {
		return nil, nil, liveerrors.LiveAdTermsOutdated
	}
	if settings.MaxInterruptions < 0 || settings.MaxInterruptions > 3 || settings.MinIntervalMinutes < 0 {
		return nil, nil, liveerrors.Unprocessable("LIVE_AD_SETTINGS_INVALID", "Allow 0 to 3 interruptions and a non-negative interval.")
	}
	for _, placement := range settings.Placements {
		if !slices.Contains(liveAdPlacements, placement) {
			return nil, nil, liveerrors.Unprocessable("LIVE_AD_SETTINGS_INVALID", "Unknown ad placement "+placement+".")
		}
	}
	now := formatTime(service.Now())
	record := map[string]any{
		"allowAds": settings.AllowAds, "placements": append([]string{}, settings.Placements...), "maxInterruptions": settings.MaxInterruptions,
		"minIntervalMinutes": settings.MinIntervalMinutes, "showAdIndicator": settings.ShowAdIndicator,
		"acceptedTermsVersion": nil, "acceptedAt": nil,
	}
	var version *string
	if input.AcceptedLiveAdTermsVersion != "" {
		accepted := input.AcceptedLiveAdTermsVersion
		version = &accepted
		record["acceptedTermsVersion"], record["acceptedAt"] = accepted, now
	}
	return record, version, nil
}

func (service *LiveService) CreateLiveSession(ctx context.Context, actor types.Actor, input types.CreateLiveSessionInput) (types.LiveSessionView, error) {
	if service.Settings.RequireCreatorProgramToHost && !actor.HasRole("creator") && !actor.HasRole("admin") {
		return types.LiveSessionView{}, liveerrors.CreatorProgramNeeded
	}
	isSeller := actor.HasRole("seller")
	if input.Category == "shopping" && !isSeller && input.StoreId == nil {
		return types.LiveSessionView{}, liveerrors.ShoppingNeedsStore
	}
	if len(input.ProductIds) > 0 && input.StoreId == nil {
		return types.LiveSessionView{}, liveerrors.LiveHasNoStore
	}
	var products map[uuid.UUID]interfaces.StoreProduct
	if input.StoreId != nil {
		if err := service.requireStoreMember(ctx, *input.StoreId, actor.UserId); err != nil {
			return types.LiveSessionView{}, err
		}
		if len(input.ProductIds) > 0 {
			owned, err := service.requireStoreProducts(ctx, *input.StoreId, input.ProductIds, false)
			if err != nil {
				return types.LiveSessionView{}, err
			}
			products = owned
		}
	}
	if input.ScheduledAt != nil {
		if input.StartNow {
			return types.LiveSessionView{}, liveerrors.Unprocessable("SCHEDULE_WITH_START_NOW", "A scheduled live can't also start now.")
		}
		if err := service.validateSchedule(*input.ScheduledAt); err != nil {
			return types.LiveSessionView{}, err
		}
	}
	adSettings, termsVersion, err := service.buildLiveAdSettingsRecord(input.Monetization)
	if err != nil {
		return types.LiveSessionView{}, err
	}
	now := service.Now()
	var audience liveStartedAudience
	if input.StartNow {
		audience = service.resolveLiveStartedAudience(ctx, actor.UserId, input.Visibility)
	}
	var created *ent.LiveSession
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "live-host:"+actor.UserId.String()); err != nil {
			return err
		}
		running, err := tx.LiveSession.Query().Where(livesession.HostID(actor.UserId), livesession.StateIn(livesession.StateLive, livesession.StateConnecting)).First(ctx)
		if err == nil {
			return liveAlreadyRunning(running.ID)
		}
		if !ent.IsNotFound(err) {
			return err
		}
		identifier := schema.NewTimeOrderedUuid()
		builder := tx.LiveSession.Create().SetID(identifier).SetHostID(actor.UserId).SetTitle(strings.TrimSpace(input.Title)).
			SetCategory(livesession.Category(input.Category)).SetVisibility(livesession.Visibility(input.Visibility)).
			SetLivekitRoom("live-" + identifier.String()).SetHostIsCreator(actor.HasRole("creator")).SetCountryCode(input.CountryCode).
			SetNillableStoreID(input.StoreId).SetNillableScheduledAt(input.ScheduledAt)
		if adSettings != nil {
			builder.SetLiveAdSettings(adSettings).SetNillableAcceptedLiveAdTermsVersion(termsVersion)
			if termsVersion != nil {
				builder.SetAcceptedLiveAdTermsAt(now)
			}
		}
		if input.Monetization.SponsorshipLine != "" {
			builder.SetSponsorshipLine(input.Monetization.SponsorshipLine)
		}
		if input.StartNow {
			builder.SetState(livesession.StateLive).SetStartedAt(now)
		}
		if created, err = builder.Save(ctx); err != nil {
			return err
		}
		for _, productId := range input.ProductIds {
			if err := snapshotLiveProduct(tx.LiveProduct.Create().SetLiveID(identifier).SetProductID(productId), products[productId]).Exec(ctx); err != nil {
				return err
			}
		}
		if err := tx.GuestSlot.Create().SetLiveID(identifier).SetUserID(actor.UserId).SetRole("host").SetState("onStage").
			SetExpiresAt(now).SetJoinedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := service.applyHostDefaultsInTransaction(ctx, tx, identifier, actor.UserId); err != nil {
			return err
		}
		if created.ScheduledAt != nil {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveScheduled, identifier.String(), now, scheduledEventData(created))
		}
		if !input.StartNow {
			return nil
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveStarted, identifier.String(), now, liveStartedEventData(created, now, audience))
	})
	if err != nil {
		return types.LiveSessionView{}, err
	}
	if input.StartNow {
		service.afterLiveWentLive(ctx, created)
	}
	return service.presentLiveSession(ctx, created)
}

func liveAlreadyRunning(liveId uuid.UUID) error {
	failure := liveerrors.Api(liveerrors.LiveAlreadyRunning.Status, liveerrors.LiveAlreadyRunning.Code, liveerrors.LiveAlreadyRunning.Message)
	failure.Details = map[string]any{"liveId": liveId.String()}
	return failure
}
