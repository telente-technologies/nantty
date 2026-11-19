package developersso

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	signingkeys "nantty/modules/auth/src/modules/signingKeys/services"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type Config struct {
	ClientId     string
	ClientSecret string
	RedirectUris []string
	LoginUrl     string
}

func ReadConfigFromEnv() Config {
	var uris []string
	for _, raw := range strings.Split(os.Getenv("AUTH_DEVELOPER_SSO_REDIRECT_URIS"), ",") {
		if trimmed := strings.TrimSpace(raw); trimmed != "" {
			uris = append(uris, trimmed)
		}
	}
	return Config{
		ClientId:     strings.TrimSpace(os.Getenv("AUTH_DEVELOPER_SSO_CLIENT_ID")),
		ClientSecret: strings.TrimSpace(os.Getenv("AUTH_DEVELOPER_SSO_CLIENT_SECRET")),
		RedirectUris: uris,
		LoginUrl:     strings.TrimSpace(os.Getenv("AUTH_DEVELOPER_SSO_LOGIN_URL")),
	}
}

type Controller struct {
	Container *container.Container
	Config    Config
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	controller := Controller{Container: deployed, Config: ReadConfigFromEnv()}
	rateLimit := httpserver.RateLimitEveryRequest(false)
	mux.Handle("GET /api/v1/auth/sso/authorize", rateLimit(http.HandlerFunc(controller.Authorize)))
	mux.Handle("POST /api/v1/auth/sso/token", rateLimit(http.HandlerFunc(controller.ExchangeToken)))
}

func (controller Controller) Authorize(writer http.ResponseWriter, request *http.Request) {
	if controller.Config.ClientId == "" || controller.Config.ClientSecret == "" || len(controller.Config.RedirectUris) == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(
			http.StatusServiceUnavailable, "SSO_NOT_CONFIGURED", "Cross-domain developer SSO is not configured.",
		))
		return
	}
	q := request.URL.Query()
	clientId := strings.TrimSpace(q.Get("client_id"))
	redirectIdx := slices.Index(controller.Config.RedirectUris, strings.TrimSpace(q.Get("redirect_uri")))
	challenge := strings.TrimSpace(q.Get("code_challenge"))
	method := strings.TrimSpace(q.Get("code_challenge_method"))
	if clientId != controller.Config.ClientId || redirectIdx < 0 || method != "S256" || len(challenge) < 43 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(
			http.StatusBadRequest, "INVALID_SSO_REQUEST", "Valid client_id, allowlisted redirect_uri, and S256 code_challenge are required.",
		))
		return
	}
	allowedRedirectUri := controller.Config.RedirectUris[redirectIdx]
	principal, ok := controller.authenticateAuthorizeRequest(request)
	if !ok {
		if controller.Config.LoginUrl != "" && !wantsJsonResponse(request) {
			if target, err := url.Parse(controller.Config.LoginUrl); err == nil {
				params := target.Query()
				params.Set("next", request.URL.RequestURI())
				target.RawQuery = params.Encode()
				writer.Header().Set("Cache-Control", "no-store, max-age=0")
				http.Redirect(writer, request, target.String(), http.StatusFound)
				return
			}
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	code := base64.RawURLEncoding.EncodeToString(rawBytes)
	codeHash := sha256Hex(code)
	now := controller.Container.Now().UTC()
	_, err := controller.Container.Database.ExecContext(request.Context(),
		`INSERT INTO developer_sso_codes (code_hash, account_id, session_id, client_id, redirect_uri, code_challenge, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		codeHash, uuid.MustParse(principal.UserId), uuid.MustParse(principal.SessionId), clientId, allowedRedirectUri, challenge, now.Add(60*time.Second), now,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	state := q.Get("state")
	if wantsJsonResponse(request) {
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{
			"code": code, "state": state, "redirectUri": allowedRedirectUri, "expiresIn": 60,
		})
		return
	}
	target, err := url.Parse(allowedRedirectUri)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	params := target.Query()
	params.Set("code", code)
	if state != "" {
		params.Set("state", state)
	}
	target.RawQuery = params.Encode()
	writer.Header().Set("Cache-Control", "no-store, max-age=0")
	http.Redirect(writer, request, target.String(), http.StatusFound)
}

func (controller Controller) authenticateAuthorizeRequest(request *http.Request) (jwtauth.Principal, bool) {
	if controller.Container.AccessVerifier == nil {
		return jwtauth.Principal{}, false
	}
	rawToken := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
	if rawToken == "" {
		for _, cookieName := range []string{"__Host-zd_at", "zd_webapp_at"} {
			if c, err := request.Cookie(cookieName); err == nil && strings.TrimSpace(c.Value) != "" {
				rawToken = strings.TrimSpace(c.Value)
				break
			}
		}
	}
	if rawToken == "" {
		return jwtauth.Principal{}, false
	}
	principal, err := controller.Container.AccessVerifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
	if err != nil {
		return jwtauth.Principal{}, false
	}
	accountId, accountErr := uuid.Parse(principal.UserId)
	sessionId, sessionErr := uuid.Parse(principal.SessionId)
	if accountErr != nil || sessionErr != nil {
		return jwtauth.Principal{}, false
	}
	var active bool
	if err := controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT EXISTS (
		   SELECT 1 FROM sessions s JOIN accounts a ON a.id = s.account_id
		   WHERE s.id = $1 AND s.account_id = $2 AND s.revoked_at IS NULL
		     AND s.expires_at > now() AND a.status = 'active'
		 )`, sessionId, accountId,
	).Scan(&active); err != nil || !active {
		return jwtauth.Principal{}, false
	}
	return principal, true
}

func wantsJsonResponse(request *http.Request) bool {
	if strings.EqualFold(request.URL.Query().Get("response_mode"), "json") || strings.EqualFold(request.URL.Query().Get("format"), "json") {
		return true
	}
	accept := strings.ToLower(request.Header.Get("Accept"))
	return strings.Contains(accept, "application/json") && !strings.Contains(accept, "text/html")
}

type tokenExchangeRequest struct {
	ClientId     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Code         string `json:"code"`
	RedirectUri  string `json:"redirectUri"`
	CodeVerifier string `json:"codeVerifier"`
}

func (controller Controller) ExchangeToken(writer http.ResponseWriter, request *http.Request) {
	if controller.Config.ClientId == "" || controller.Config.ClientSecret == "" {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(
			http.StatusServiceUnavailable, "SSO_NOT_CONFIGURED", "Cross-domain developer SSO is not configured.",
		))
		return
	}
	var body tokenExchangeRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if subtle.ConstantTimeCompare([]byte(body.ClientId), []byte(controller.Config.ClientId)) != 1 ||
		subtle.ConstantTimeCompare([]byte(body.ClientSecret), []byte(controller.Config.ClientSecret)) != 1 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(
			http.StatusUnauthorized, "INVALID_SSO_CLIENT", "Invalid SSO client credentials.",
		))
		return
	}
	codeHash := sha256Hex(strings.TrimSpace(body.Code))
	now := controller.Container.Now().UTC()
	accountId, sessionId, err := ConsumeCode(request.Context(), controller.Container.Database, codeHash, body.ClientId, body.RedirectUri, body.CodeVerifier, now)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	accessToken, err := controller.Container.TokenIssuer.SignAccessTokenWithActiveKey(signingkeys.AccessTokenClaims{
		AccountId: accountId,
		SessionId: sessionId,
		Roles:     []string{"user"},
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{
		"accessToken": accessToken,
		"tokenType":   "Bearer",
		"expiresIn":   controller.Container.TokenIssuer.TimeToLiveInSeconds(),
	})
}

func VerifyPKCES256(verifier, challenge string) bool {
	if len(verifier) < 43 || len(verifier) > 128 {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(computed), []byte(challenge)) == 1
}

func sha256Hex(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
