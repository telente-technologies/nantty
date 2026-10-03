package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/config"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/media"
	"zudomart/modules/live/internal/ports"
	"zudomart/platform/httpserver"
)

const eventSource = "zudomart.live"

type Dependencies struct {
	Client    *ent.Client
	Settings  config.LiveSettings
	Money     ports.MoneyGateway
	Directory ports.ParticipantDirectory
	Media     ports.MediaRoomController
	Tokens    *media.TokenIssuer
	PinPolicy ports.ProductPinPolicy
	Logger    *slog.Logger
	Now       func() time.Time
}

type LiveApplication struct {
	Dependencies
}

func NewLiveApplication(dependencies Dependencies) *LiveApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	return &LiveApplication{Dependencies: dependencies}
}

type Actor struct {
	UserId uuid.UUID
	Roles  []string
}

func (actor Actor) HasRole(role string) bool { return slices.Contains(actor.Roles, role) }

func apiError(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

var (
	errLiveNotFound           = apiError(http.StatusNotFound, "LIVE_NOT_FOUND", "This live could not be found.")
	errLiveNotActive          = apiError(http.StatusConflict, "LIVE_NOT_ACTIVE", "This live is not active.")
	errLiveAlreadyRunning     = apiError(http.StatusConflict, "LIVE_ALREADY_RUNNING", "You are already live.")
	errNotLiveHost            = apiError(http.StatusForbidden, "NOT_LIVE_HOST", "Only the host can do that.")
	errCreatorProgramNeeded   = apiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Join the Creator Program to go live.")
	errShoppingNeedsStore     = apiError(http.StatusUnprocessableEntity, "SHOPPING_REQUIRES_STORE", "Only accounts with a store can host a shopping live.")
	errLiveAdTermsRequired    = apiError(http.StatusUnprocessableEntity, "LIVE_AD_TERMS_REQUIRED", "Accept the live-ad terms to allow ads.")
	errLiveAdTermsOutdated    = apiError(http.StatusUnprocessableEntity, "LIVE_AD_TERMS_OUTDATED", "The live-ad terms have changed. Review and accept them again.")
	errGiftNotFound           = apiError(http.StatusNotFound, "GIFT_NOT_FOUND", "That gift is not available.")
	errCannotGiftSelf         = apiError(http.StatusUnprocessableEntity, "CANNOT_GIFT_SELF", "You can't send gifts to yourself.")
	errRecipientNotOnStage    = apiError(http.StatusUnprocessableEntity, "RECIPIENT_NOT_ON_STAGE", "That streamer is no longer on stage.")
	errGiftRateLimited        = apiError(http.StatusTooManyRequests, "GIFT_RATE_LIMITED", "You are sending gifts too fast.")
	errGiftsDisabled          = apiError(http.StatusUnprocessableEntity, "GIFTS_DISABLED", "Gifts are turned off for this live.")
	errStageFull              = apiError(http.StatusConflict, "STAGE_FULL", "The stage is full. Up to 10 people can be on stage.")
	errSlotNotFound           = apiError(http.StatusNotFound, "SLOT_NOT_FOUND", "That invitation was not found.")
	errInvitationNoLongerOpen = apiError(http.StatusGone, "INVITATION_CLOSED", "This invite has expired.")
	errNotOnStage             = apiError(http.StatusNotFound, "RECIPIENT_NOT_ON_STAGE", "That guest is no longer on stage.")
	errBattleNotFound         = apiError(http.StatusNotFound, "BATTLE_NOT_FOUND", "Battle not found.")
	errBattleInProgress       = apiError(http.StatusConflict, "BATTLE_IN_PROGRESS", "A battle is already running.")
	errBattleNotWaiting       = apiError(http.StatusGone, "BATTLE_NOT_PENDING", "This battle is no longer waiting for answers.")
	errBattleAlreadyAnswered  = apiError(http.StatusConflict, "ALREADY_ANSWERED", "You already answered.")
	errMutedByHost            = apiError(http.StatusForbidden, "MUTED_BY_HOST", "The host muted you, so you cannot unmute.")
	errEngagementUnknown      = apiError(http.StatusBadRequest, "UNKNOWN_ENGAGEMENT_ACTION", "Unknown engagement action.")
)

func unprocessable(code, message string) *httpserver.ApiError {
	return apiError(http.StatusUnprocessableEntity, code, message)
}

func (application *LiveApplication) runInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := application.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
