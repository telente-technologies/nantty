package stepup

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/generated/ent/session"
	signingkeys "zudomart/modules/auth/src/modules/signingKeys/services"
	"zudomart/modules/auth/src/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

const StepUpTimeToLive = 5 * time.Minute

var (
	ErrStepUpProofMissing = httpserver.NewApiError(http.StatusBadRequest, "STEP_UP_PROOF_REQUIRED", "Enter your password or the code we emailed you.")
	ErrStepUpProofInvalid = httpserver.NewApiError(http.StatusUnauthorized, "STEP_UP_FAILED", "We could not confirm it's you. Try again.")
)

type GrantStepUpCommand struct {
	AccountId string
	SessionId string
	Roles     []string
	Password  string
	OtpToken  string
}

type GrantStepUpResult struct {
	StepUpToken string `json:"stepUpToken"`
	ExpiresIn   int    `json:"expiresIn"`
	Method      string `json:"method"`
}

type GrantStepUpHandler struct {
	*container.Container
}

func (application GrantStepUpHandler) Execute(ctx context.Context, command GrantStepUpCommand) (GrantStepUpResult, error) {
	accountId, accountErr := uuid.Parse(command.AccountId)
	sessionId, sessionErr := uuid.Parse(command.SessionId)
	if accountErr != nil || sessionErr != nil {
		return GrantStepUpResult{}, authErrors.ErrInvalidCredentials
	}
	method := ""
	var username string
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).Only(ctx)
		if ent.IsNotFound(err) {
			return authErrors.ErrInvalidCredentials
		}
		if err != nil {
			return err
		}
		username = existing.Username
		live, err := tx.Session.Query().Where(session.ID(sessionId), session.AccountID(accountId), session.RevokedAtIsNil(), session.ExpiresAtGT(application.Now())).Exist(ctx)
		if err != nil {
			return err
		}
		if !live {
			return authErrors.ErrInvalidRefreshToken
		}
		if existing.PasswordHash != nil {
			method = "password"
			return application.checkPassword(command.Password, *existing.PasswordHash)
		}
		method = "emailCode"
		if command.OtpToken == "" {
			return ErrStepUpProofMissing
		}
		destination, err := services.ConsumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeLoginVerified, command.OtpToken, application.Now)
		if err != nil || existing.Email == nil || destination != *existing.Email {
			return ErrStepUpProofInvalid
		}
		return nil
	})
	if err != nil {
		return GrantStepUpResult{}, err
	}
	token, err := application.TokenIssuer.SignTokenForAudience(jwtauth.UserStepUpAudience, StepUpTimeToLive, signingkeys.AccessTokenClaims{
		AccountId: command.AccountId, SessionId: command.SessionId, Roles: command.Roles,
	})
	if err != nil {
		return GrantStepUpResult{}, err
	}
	services.RecordAccountSecurityEvent(ctx, application.Container, accountId, username, "stepUp.granted", map[string]any{"sessionId": command.SessionId, "method": method})
	return GrantStepUpResult{StepUpToken: token, ExpiresIn: int(StepUpTimeToLive.Seconds()), Method: method}, nil
}

func (application GrantStepUpHandler) checkPassword(password, hash string) error {
	if password == "" {
		return ErrStepUpProofMissing
	}
	matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(password, hash)
	if err != nil || !matches {
		return ErrStepUpProofInvalid
	}
	return nil
}
