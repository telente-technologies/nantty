package httpapi

import (
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
)

type LiveRoutes struct {
	Application        *application.LiveApplication
	AccessVerifier     *jwtauth.AccessTokenVerifier
	IdempotencyStore   *idempotency.RedisStore
	Logger             *slog.Logger
	LiveAdTermsVersion string
}

func (routes LiveRoutes) MountLiveRoutes(mux *http.ServeMux) {
	authenticated := func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(routes.AccessVerifier)(handler)
	}
	idempotent := func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(routes.AccessVerifier)(routes.requireIdempotencyKey(handler))
	}
	admin := func(handler http.HandlerFunc) http.Handler {
		return jwtauth.RequireVerifiedAccessToken(routes.AccessVerifier)(routes.requireAdminRole(handler))
	}
	routes.mountSessionRoutes(mux, authenticated)
	routes.mountStageRoutes(mux, authenticated, idempotent)
	routes.mountGiftRoutes(mux, authenticated, idempotent, admin)
	routes.mountPointsRoutes(mux, authenticated)
}

func (routes LiveRoutes) mountSessionRoutes(mux *http.ServeMux, authenticated func(http.HandlerFunc) http.Handler) {
	mux.Handle("POST /api/v1/lives", authenticated(routes.createLiveSession))
	mux.Handle("GET /api/v1/lives/suggested", authenticated(routes.listSuggestedLives))
	mux.Handle("GET /api/v1/lives/{liveId}", authenticated(routes.getLiveSession))
	mux.Handle("POST /api/v1/lives/{liveId}/start", authenticated(routes.startLiveSession))
	mux.Handle("POST /api/v1/lives/{liveId}/end", authenticated(routes.endLiveSession))
	mux.Handle("POST /api/v1/lives/{liveId}/join", authenticated(routes.joinLive))
	mux.Handle("POST /api/v1/lives/{liveId}/leave", authenticated(routes.leaveLive))
	mux.Handle("POST /api/v1/lives/{liveId}/reactions", authenticated(routes.acknowledgeReaction))
	mux.Handle("POST /api/v1/lives/{liveId}/share", authenticated(routes.shareLive))
	mux.Handle("PUT /api/v1/lives/{liveId}/monetization", authenticated(routes.updateLiveMonetization))
	mux.Handle("POST /api/v1/lives/{liveId}/media-token", authenticated(routes.issueMediaToken))
	mux.Handle("POST /api/v1/lives/{liveId}/pins", authenticated(routes.pinProduct))
	mux.Handle("GET /api/v1/lives/{liveId}/products", authenticated(routes.listLiveProducts))
}

func (routes LiveRoutes) mountStageRoutes(mux *http.ServeMux, authenticated func(http.HandlerFunc) http.Handler, idempotent func(http.HandlerFunc) http.Handler) {
	mux.Handle("GET /api/v1/lives/{liveId}/stage", authenticated(routes.getLiveStage))
	mux.Handle("GET /api/v1/lives/{liveId}/viewers", authenticated(routes.searchViewersToInvite))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/invitations", authenticated(routes.inviteGuest))
	mux.Handle("DELETE /api/v1/lives/{liveId}/guests/invitations/{slotId}", authenticated(routes.cancelGuestInvitation))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/invitations/{slotId}/{response}", authenticated(routes.respondToInvitation))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/requests", authenticated(routes.requestToJoinStage))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/requests/{requestId}/{decision}", authenticated(routes.decideJoinRequest))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/{userId}/remove", authenticated(routes.removeGuest))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/{userId}/mute", authenticated(routes.muteStreamer))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/me/leave", authenticated(routes.leaveStage))
	mux.Handle("POST /api/v1/lives/{liveId}/guests/me/connection", authenticated(routes.reportGuestConnection))
	mux.Handle("POST /api/v1/lives/{liveId}/battles", idempotent(routes.createBattle))
	mux.Handle("POST /api/v1/battles/{battleId}/{action}", authenticated(routes.actOnBattle))
}

func (routes LiveRoutes) mountGiftRoutes(mux *http.ServeMux, authenticated, idempotent, admin func(http.HandlerFunc) http.Handler) {
	mux.Handle("GET /api/v1/gifts", authenticated(routes.listGiftCatalog))
	mux.Handle("POST /api/v1/live/gifts", idempotent(routes.sendGift))
	mux.Handle("POST /api/v1/lives/{liveId}/gifts", idempotent(routes.sendGiftToPathLive))
	mux.Handle("GET /api/v1/lives/{liveId}/leaderboard", authenticated(routes.getLeaderboard))
	mux.Handle("GET /api/v1/creators/me/analytics/gifts/streams/{liveId}", authenticated(routes.getStreamStats))
	mux.Handle("GET /api/v1/lives/{liveId}/gift-goals", authenticated(routes.listGiftGoals))
	mux.Handle("POST /api/v1/lives/{liveId}/gift-goals", authenticated(routes.createGiftGoal))
	mux.Handle("PATCH /api/v1/lives/{liveId}/gift-goals/{goalId}", authenticated(routes.updateGiftGoal))
	mux.Handle("DELETE /api/v1/lives/{liveId}/gift-goals/{goalId}", authenticated(routes.cancelGiftGoal))
	mux.Handle("GET /api/v1/admin/gifts", admin(routes.listAllGifts))
	mux.Handle("POST /api/v1/admin/gifts", admin(routes.createGift))
	mux.Handle("PATCH /api/v1/admin/gifts/{giftId}", admin(routes.updateGift))
	mux.Handle("DELETE /api/v1/admin/gifts/{giftId}", admin(routes.retireGift))
}

func (routes LiveRoutes) mountPointsRoutes(mux *http.ServeMux, authenticated func(http.HandlerFunc) http.Handler) {
	mux.Handle("GET /api/v1/lives/{liveId}/points/me", authenticated(routes.getMyLivePoints))
	mux.Handle("POST /api/v1/lives/{liveId}/engagement", authenticated(routes.awardEngagement))
	mux.Handle("GET /api/v1/rankings", authenticated(routes.getRankings))
}

func (routes LiveRoutes) requireIdempotencyKey(handler http.HandlerFunc) http.Handler {
	if routes.IdempotencyStore != nil {
		return idempotency.RequireIdempotencyKeyAndReplayCompletedResponses(routes.IdempotencyStore, idempotency.MoneyMovingTimeToLive, routes.Logger)(handler)
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !idempotency.IsValidIdempotencyKey(request.Header.Get("Idempotency-Key")) {
			httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _."))
			return
		}
		handler(writer, request)
	})
}

func (routes LiveRoutes) requireAdminRole(handler http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		if !slices.Contains(principal.Roles, "admin") {
			httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
			return
		}
		handler(writer, request)
	})
}

func (routes LiveRoutes) actorFrom(request *http.Request) (application.Actor, error) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	userId, err := uuid.Parse(principal.UserId)
	if err != nil {
		return application.Actor{}, httpserver.ErrUnauthorized
	}
	return application.Actor{UserId: userId, Roles: principal.Roles}, nil
}

func pathIdentifier(request *http.Request, name string) (uuid.UUID, error) {
	value := request.PathValue(name)
	identifier, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return identifier, nil
}

func (routes LiveRoutes) respondWithError(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
}

func clientRegion(request *http.Request) string {
	region := strings.ToUpper(strings.TrimSpace(request.Header.Get("X-Client-Region")))
	if len(region) != 2 {
		return ""
	}
	return region
}
