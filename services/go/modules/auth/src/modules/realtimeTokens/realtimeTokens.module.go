package realtimetokens

import (
	"context"
	"net/http"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/session"
	signingkeys "zudomart/modules/auth/src/modules/signingKeys/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type IssueRealtimeTokenResult struct {
	RealtimeToken string `json:"realtimeToken"`
	ExpiresIn     int    `json:"expiresIn"`
	Scope         string `json:"scope"`
}

type IssueRealtimeTokenHandler struct {
	*container.Container
}

func (application IssueRealtimeTokenHandler) Execute(ctx context.Context, principal jwtauth.Principal) (IssueRealtimeTokenResult, error) {
	accountId, accountErr := uuid.Parse(principal.UserId)
	sessionId, sessionErr := uuid.Parse(principal.SessionId)
	if accountErr != nil || sessionErr != nil || principal.Scope != "" {
		return IssueRealtimeTokenResult{}, authErrors.ErrInvalidRefreshToken
	}
	if slices.Contains(principal.Roles, "suspended") {
		return IssueRealtimeTokenResult{}, authErrors.ErrAccountSuspended
	}
	active, err := application.Client.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).Exist(ctx)
	if err != nil {
		return IssueRealtimeTokenResult{}, err
	}
	live, err := application.Client.Session.Query().Where(session.ID(sessionId), session.AccountID(accountId), session.RevokedAtIsNil(), session.ExpiresAtGT(application.Now())).Exist(ctx)
	if err != nil {
		return IssueRealtimeTokenResult{}, err
	}
	if !active || !live {
		return IssueRealtimeTokenResult{}, authErrors.ErrInvalidRefreshToken
	}
	timeToLive := jwtauth.RealtimeTokenDefaultTimeToLive
	token, err := application.TokenIssuer.SignTokenForAudience(jwtauth.RealtimeTokenAudience, timeToLive, signingkeys.AccessTokenClaims{
		AccountId: principal.UserId, SessionId: principal.SessionId, Roles: principal.Roles, Scope: jwtauth.RealtimeTokenScope, TokenId: uuid.NewString(),
	})
	if err != nil {
		return IssueRealtimeTokenResult{}, err
	}
	return IssueRealtimeTokenResult{RealtimeToken: token, ExpiresIn: int(timeToLive.Seconds()), Scope: jwtauth.RealtimeTokenScope}, nil
}

func Mount(mux *http.ServeMux, container *container.Container) {
	requireSessionToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	issue := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		result, err := IssueRealtimeTokenHandler{Container: container}.Execute(request.Context(), principal)
		if err != nil {
			httpserver.WriteErrorResponse(writer, request, container.Logger, err)
			return
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
	})
	mux.Handle("POST /api/v1/auth/realtime-token", httpserver.RateLimitAuthEndpoints()(requireSessionToken(issue)))
}
