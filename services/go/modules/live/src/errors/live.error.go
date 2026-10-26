package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

func Api(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

func Unprocessable(code, message string) *httpserver.ApiError {
	return Api(http.StatusUnprocessableEntity, code, message)
}

var (
	LiveNotFound           = Api(http.StatusNotFound, "LIVE_NOT_FOUND", "This live could not be found.")
	LiveNotActive          = Api(http.StatusConflict, "LIVE_NOT_ACTIVE", "This live is not active.")
	LiveAlreadyRunning     = Api(http.StatusConflict, "LIVE_ALREADY_RUNNING", "You are already live.")
	NotLiveHost            = Api(http.StatusForbidden, "NOT_LIVE_HOST", "Only the host can do that.")
	LiveRestricted         = Api(http.StatusForbidden, "LIVE_RESTRICTED", "Going live is paused on your account because of active strikes. See Settings > Account status.")
	CreatorProgramNeeded   = Api(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Join the Creator Program to go live.")
	ShoppingNeedsStore     = Api(http.StatusUnprocessableEntity, "SHOPPING_REQUIRES_STORE", "Only accounts with a store can host a shopping live.")
	LiveAdTermsRequired    = Api(http.StatusUnprocessableEntity, "LIVE_AD_TERMS_REQUIRED", "Accept the live-ad terms to allow ads.")
	LiveAdTermsOutdated    = Api(http.StatusUnprocessableEntity, "LIVE_AD_TERMS_OUTDATED", "The live-ad terms have changed. Review and accept them again.")
	GiftNotFound           = Api(http.StatusNotFound, "GIFT_NOT_FOUND", "That gift is not available.")
	CannotGiftSelf         = Api(http.StatusUnprocessableEntity, "CANNOT_GIFT_SELF", "You can't send gifts to yourself.")
	RecipientNotOnStage    = Api(http.StatusUnprocessableEntity, "RECIPIENT_NOT_ON_STAGE", "That streamer is no longer on stage.")
	GiftRateLimited        = Api(http.StatusTooManyRequests, "GIFT_RATE_LIMITED", "You are sending gifts too fast.")
	GiftsDisabled          = Api(http.StatusUnprocessableEntity, "GIFTS_DISABLED", "Gifts are turned off for this live.")
	StageFull              = Api(http.StatusConflict, "STAGE_FULL", "The stage is full. Up to 10 people can be on stage.")
	SlotNotFound           = Api(http.StatusNotFound, "SLOT_NOT_FOUND", "That invitation was not found.")
	InvitationNoLongerOpen = Api(http.StatusGone, "INVITATION_CLOSED", "This invite has expired.")
	NotOnStage             = Api(http.StatusNotFound, "RECIPIENT_NOT_ON_STAGE", "That guest is no longer on stage.")
	BattleNotFound         = Api(http.StatusNotFound, "BATTLE_NOT_FOUND", "Battle not found.")
	BattleInProgress       = Api(http.StatusConflict, "BATTLE_IN_PROGRESS", "A battle is already running.")
	BattleNotWaiting       = Api(http.StatusGone, "BATTLE_NOT_PENDING", "This battle is no longer waiting for answers.")
	BattleAlreadyAnswered  = Api(http.StatusConflict, "ALREADY_ANSWERED", "You already answered.")
	MutedByHost            = Api(http.StatusForbidden, "MUTED_BY_HOST", "The host muted you, so you cannot unmute.")
	EngagementUnknown      = Api(http.StatusBadRequest, "UNKNOWN_ENGAGEMENT_ACTION", "Unknown engagement action.")
	CatalogUnavailable     = Api(http.StatusServiceUnavailable, "CATALOG_UNAVAILABLE", "Store details can't be checked right now. Try again shortly.")
	NotStoreMember         = Api(http.StatusForbidden, "NOT_STORE_MEMBER", "You can only go live for a store you belong to.")
	ProductNotInStore      = Api(http.StatusForbidden, "PRODUCT_NOT_IN_STORE", "You can only show products from this live's store.")
	ProductNotPublished    = Unprocessable("PRODUCT_NOT_PUBLISHED", "Publish the product before showing it on screen.")
	LiveHasNoStore         = Unprocessable("PRODUCTS_REQUIRE_STORE", "Start the live for a store to show products.")
)
