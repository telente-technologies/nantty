package widgettokens

import (
	"context"
	"errors"
	"net/http"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/session"
	signingkeys "zudomart/modules/auth/src/modules/signingKeys/services"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

var ErrWidgetTokensUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "WIDGET_TOKENS_UNAVAILABLE", "Widgets can't refresh right now. Try again later.")

type IssueWidgetTokenCommand struct {
	AccountId string
	SessionId string
	Roles     []string
}

type IssueWidgetTokenResult struct {
	WidgetToken string `json:"widgetToken"`
	ExpiresIn   int    `json:"expiresIn"`
	Scope       string `json:"scope"`
}

type IssueWidgetTokenHandler struct {
	*container.Container
}

func (application IssueWidgetTokenHandler) Execute(ctx context.Context, command IssueWidgetTokenCommand) (IssueWidgetTokenResult, error) {
	accountId, accountErr := uuid.Parse(command.AccountId)
	sessionId, sessionErr := uuid.Parse(command.SessionId)
	if accountErr != nil || sessionErr != nil {
		return IssueWidgetTokenResult{}, authErrors.ErrInvalidRefreshToken
	}
	if slices.Contains(command.Roles, "suspended") {
		return IssueWidgetTokenResult{}, authErrors.ErrAccountSuspended
	}
	owner, err := application.Client.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return IssueWidgetTokenResult{}, err
	}
	live, err := application.Client.Session.Query().Where(session.ID(sessionId), session.AccountID(accountId), session.RevokedAtIsNil(), session.ExpiresAtGT(application.Now())).Exist(ctx)
	if err != nil {
		return IssueWidgetTokenResult{}, err
	}
	if owner == nil || !live {
		return IssueWidgetTokenResult{}, authErrors.ErrInvalidRefreshToken
	}
	registry := jwtauth.RegisteredWidgetTokenRegistry()
	if registry == nil && application.Settings.IsProduction() {
		return IssueWidgetTokenResult{}, ErrWidgetTokensUnavailable
	}
	timeToLive := application.Settings.WidgetTokenTimeToLive
	tokenId := uuid.NewString()
	token, err := application.TokenIssuer.SignTokenForAudience(jwtauth.WidgetTokenAudience, timeToLive, signingkeys.AccessTokenClaims{
		AccountId: command.AccountId, SessionId: command.SessionId, Scope: jwtauth.WidgetTokenScope, TokenId: tokenId,
		AgeBracket: utils.AgeBracketFromBirthday(owner.Birthday, application.Now()),
	})
	if err != nil {
		return IssueWidgetTokenResult{}, err
	}
	if registry != nil {
		if err := registry.RecordCurrentWidgetToken(ctx, command.SessionId, tokenId, timeToLive); err != nil {
			return IssueWidgetTokenResult{}, errors.Join(ErrWidgetTokensUnavailable, err)
		}
	}
	return IssueWidgetTokenResult{WidgetToken: token, ExpiresIn: int(timeToLive.Seconds()), Scope: jwtauth.WidgetTokenScope}, nil
}

func RevokeWidgetTokenForSession(ctx context.Context, sessionId string) error {
	registry := jwtauth.RegisteredWidgetTokenRegistry()
	if registry == nil {
		return nil
	}
	return registry.ForgetWidgetTokens(ctx, []string{sessionId})
}
