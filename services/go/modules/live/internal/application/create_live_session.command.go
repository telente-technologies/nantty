package application

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/schema"
)

type LiveAdSettingsInput struct {
	AllowAds           bool     `json:"allowAds"`
	Placements         []string `json:"placements"`
	MaxInterruptions   int      `json:"maxInterruptions"`
	MinIntervalMinutes int      `json:"minIntervalMinutes"`
	ShowAdIndicator    bool     `json:"showAdIndicator"`
}

type LiveMonetizationInput struct {
	LiveAdSettings             *LiveAdSettingsInput
	AcceptedLiveAdTermsVersion string
	SponsorshipLine            string
}

type CreateLiveSessionInput struct {
	Title        string
	Category     string
	Visibility   string
	StoreId      *uuid.UUID
	ProductIds   []uuid.UUID
	StartNow     bool
	CountryCode  string
	Monetization LiveMonetizationInput
}

var liveAdPlacements = []string{"beforeJoin", "naturalBreak", "betweenSegments", "overlay", "end"}

func (application *LiveApplication) buildLiveAdSettingsRecord(input LiveMonetizationInput) (map[string]any, *string, error) {
	if input.LiveAdSettings == nil {
		return nil, nil, nil
	}
	settings := input.LiveAdSettings
	if settings.AllowAds && input.AcceptedLiveAdTermsVersion == "" {
		return nil, nil, errLiveAdTermsRequired
	}
	if input.AcceptedLiveAdTermsVersion != "" && input.AcceptedLiveAdTermsVersion != application.Settings.LiveAdTermsCurrentVersion {
		return nil, nil, errLiveAdTermsOutdated
	}
	if settings.MaxInterruptions < 0 || settings.MaxInterruptions > 3 || settings.MinIntervalMinutes < 0 {
		return nil, nil, unprocessable("LIVE_AD_SETTINGS_INVALID", "Allow 0 to 3 interruptions and a non-negative interval.")
	}
	for _, placement := range settings.Placements {
		if !slices.Contains(liveAdPlacements, placement) {
			return nil, nil, unprocessable("LIVE_AD_SETTINGS_INVALID", "Unknown ad placement "+placement+".")
		}
	}
	now := formatTime(application.Now())
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

func (application *LiveApplication) CreateLiveSession(ctx context.Context, actor Actor, input CreateLiveSessionInput) (LiveSessionView, error) {
	if application.Settings.RequireCreatorProgramToHost && !actor.HasRole("creator") && !actor.HasRole("admin") {
		return LiveSessionView{}, errCreatorProgramNeeded
	}
	isSeller := actor.HasRole("seller")
	if input.Category == "shopping" && !isSeller {
		return LiveSessionView{}, errShoppingNeedsStore
	}
	if len(input.ProductIds) > 0 {
		if err := application.PinPolicy.CanPinProducts(ctx, actor.UserId, actor.Roles, input.ProductIds); err != nil {
			return LiveSessionView{}, err
		}
	}
	adSettings, termsVersion, err := application.buildLiveAdSettingsRecord(input.Monetization)
	if err != nil {
		return LiveSessionView{}, err
	}
	now := application.Now()
	var created *ent.LiveSession
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		running, err := tx.LiveSession.Query().Where(livesession.HostID(actor.UserId), livesession.StateIn(livesession.StateLive, livesession.StateConnecting)).Exist(ctx)
		if err != nil || running {
			return orLiveAlreadyRunning(err)
		}
		identifier := schema.NewTimeOrderedUuid()
		builder := tx.LiveSession.Create().SetID(identifier).SetHostID(actor.UserId).SetTitle(strings.TrimSpace(input.Title)).
			SetCategory(livesession.Category(input.Category)).SetVisibility(livesession.Visibility(input.Visibility)).
			SetLivekitRoom("live-" + identifier.String()).SetHostIsCreator(actor.HasRole("creator")).SetCountryCode(input.CountryCode).
			SetNillableStoreID(input.StoreId)
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
			if err := tx.LiveProduct.Create().SetLiveID(identifier).SetProductID(productId).Exec(ctx); err != nil {
				return err
			}
		}
		if err := tx.GuestSlot.Create().SetLiveID(identifier).SetUserID(actor.UserId).SetRole("host").SetState("onStage").
			SetExpiresAt(now).SetJoinedAt(now).Exec(ctx); err != nil {
			return err
		}
		if !input.StartNow {
			return nil
		}
		return enqueueOutboxEventInTransaction(ctx, tx, eventLiveStarted, identifier.String(), now, LiveStartedEventData{
			LiveId: identifier.String(), HostId: actor.UserId.String(), Title: created.Title, Category: string(created.Category),
		})
	})
	if err != nil {
		return LiveSessionView{}, err
	}
	return application.presentLiveSession(ctx, created)
}

func orLiveAlreadyRunning(err error) error {
	if err != nil {
		return err
	}
	return errLiveAlreadyRunning
}
