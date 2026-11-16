package messengerauth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/generated/ent/messengerauthorization"
	"nantty/modules/auth/src/generated/ent/messengertrusteddevice"
	loginwithpassword "nantty/modules/auth/src/modules/sessions/commands/logInWithPassword"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
)

const (
	authorizationTTL       = 10 * time.Minute
	authorizationCodeTTL   = 5 * time.Minute
	trustedDeviceTTL       = 365 * 24 * time.Hour
	maxAuthRequestsPerHour = 5
	maxCodeAttempts        = 5
	codeResendCooldown     = 30 * time.Second
)

var (
	errInvalidAuthorization   = httpserver.NewApiError(http.StatusNotFound, "MESSENGER_AUTHORIZATION_NOT_FOUND", "This sign-in request is invalid or has expired.")
	errAuthorizationExpired   = httpserver.NewApiError(http.StatusGone, "MESSENGER_AUTHORIZATION_EXPIRED", "This sign-in request has expired. Start again.")
	errAuthorizationState     = httpserver.NewApiError(http.StatusConflict, "MESSENGER_AUTHORIZATION_NOT_PENDING", "This sign-in request can no longer be changed.")
	errAuthorizationDenied    = httpserver.NewApiError(http.StatusForbidden, "MESSENGER_AUTHORIZATION_DENIED", "This sign-in request was denied.")
	errCodeInvalid            = httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_CODE_INVALID", "The verification code is invalid or expired.")
	errCodeAttempts           = httpserver.NewApiError(http.StatusTooManyRequests, "MESSENGER_CODE_ATTEMPTS_EXCEEDED", "Too many code attempts. Start a new sign-in request.")
	errAuthorizationThrottled = httpserver.NewApiError(http.StatusTooManyRequests, "MESSENGER_AUTHORIZATION_RATE_LIMITED", "Too many sign-in requests. Try again later.")
	errCodeCooldown           = httpserver.NewApiError(http.StatusTooManyRequests, "MESSENGER_CODE_COOLDOWN", "Wait before requesting another code.")
	errRecoveryUnavailable    = httpserver.NewApiError(http.StatusUnprocessableEntity, "MESSENGER_RECOVERY_UNAVAILABLE", "Email recovery is not available for this account. Use an existing Nantty session or contact support.")
)

type Service struct{ *container.Container }

type CreateResult struct {
	Pending       *PendingResponse
	Session       *types.AuthSessionResponse
	TrustedDevice *TrustedDeviceResponse
}

func (service Service) Create(ctx context.Context, request CreateRequest, client types.ClientDetails) (CreateResult, error) {
	accountRecord, err := (loginwithpassword.Handler{Container: service.Container}).VerifyCredentials(ctx, request.Identifier, request.Password)
	if err != nil {
		return CreateResult{}, err
	}
	if accountRecord.Status != account.StatusActive && accountRecord.Status != account.StatusSuspended {
		return CreateResult{}, authErrors.ErrInvalidCredentials
	}
	if request.TrustedDeviceToken != "" {
		trusted, err := service.loginTrustedDevice(ctx, accountRecord, request, client)
		if err != nil {
			return CreateResult{}, err
		}
		if trusted != nil {
			return *trusted, nil
		}
	}

	proof, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return CreateResult{}, err
	}
	now := service.Now()
	installationHash := services.HashBlockedIdentifier(service.Settings.OneTimeCodePepper, "device", request.InstallationID)
	var pending *ent.MessengerAuthorization
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.Account.Query().Where(account.ID(accountRecord.ID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		recent, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.AccountID(accountRecord.ID),
			messengerauthorization.CreatedAtGTE(now.Add(-time.Hour)),
		).Count(ctx)
		if err != nil {
			return err
		}
		if recent >= maxAuthRequestsPerHour {
			return errAuthorizationThrottled
		}
		pending, err = tx.MessengerAuthorization.Create().
			SetAccountID(accountRecord.ID).
			SetProofHash(utils.HashOpaqueTokenForStorage(proof)).
			SetInstallationHash(installationHash).
			SetPlatform(messengerauthorization.Platform(request.Platform)).
			SetDeviceName(strings.TrimSpace(request.DeviceName)).
			SetUserAgent(utils.TruncateToLength(client.UserAgent, 255)).
			SetIPAddress(utils.TruncateToLength(client.IpAddress, 64)).
			SetExpiresAt(now.Add(authorizationTTL)).Save(ctx)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "messenger.loginApprovalRequested", accountRecord.ID.String(), now, map[string]any{
			"accountId": accountRecord.ID.String(), "authorizationId": pending.ID.String(),
			"device": strings.TrimSpace(request.DeviceName), "platform": request.Platform,
			"requestedAt": now.UTC().Format(time.RFC3339), "expiresAt": pending.ExpiresAt.UTC().Format(time.RFC3339),
		})
	})
	if err != nil {
		return CreateResult{}, err
	}
	services.RecordAccountSecurityEvent(ctx, service.Container, accountRecord.ID, accountRecord.Username, "messenger.login_authorization.requested", map[string]any{
		"authorizationId": pending.ID.String(), "platform": request.Platform, "deviceName": request.DeviceName,
	})
	deviceContext := DeviceContext{
		Name: pending.DeviceName, Platform: string(pending.Platform),
		RequestedAt:         pending.CreatedAt.UTC().Format(time.RFC3339),
		ApproximateLocation: nil,
	}
	return CreateResult{Pending: &PendingResponse{
		AuthorizationID: pending.ID.String(), Proof: proof, Status: "pending",
		ExpiresAt: pending.ExpiresAt.UTC().Format(time.RFC3339), Methods: []string{"approve", "code", "email_recovery"},
		Device: deviceContext,
	}}, nil
}

func (service Service) loginTrustedDevice(ctx context.Context, owner *ent.Account, request CreateRequest, client types.ClientDetails) (*CreateResult, error) {
	rotatedToken, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return nil, err
	}
	now := service.Now()
	installationHash := services.HashBlockedIdentifier(service.Settings.OneTimeCodePepper, "device", request.InstallationID)
	var found bool
	var session services.StartedSession
	var response types.AuthSessionResponse
	var deviceID uuid.UUID
	var tokenExpiry time.Time
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		device, err := tx.MessengerTrustedDevice.Query().Where(
			messengertrusteddevice.AccountID(owner.ID),
			messengertrusteddevice.TokenHash(utils.HashOpaqueTokenForStorage(request.TrustedDeviceToken)),
			messengertrusteddevice.InstallationHash(installationHash),
			messengertrusteddevice.RevokedAtIsNil(),
			messengertrusteddevice.ExpiresAtGT(now),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		found = true
		deviceID, tokenExpiry = device.ID, device.ExpiresAt
		if err := tx.MessengerTrustedDevice.UpdateOneID(device.ID).
			SetTokenHash(utils.HashOpaqueTokenForStorage(rotatedToken)).
			SetLastUsedAt(now).Exec(ctx); err != nil {
			return err
		}
		if session, err = services.StartSessionWithDeviceHashInTransaction(ctx, service.Container, tx, owner.ID, client, device.InstallationHash); err != nil {
			return err
		}
		tokens, err := services.SignAccessTokenAndBuildIssuedTokens(service.Container, owner, session.SessionId, session.RefreshToken)
		if err != nil {
			return err
		}
		response = types.ConvertAuthenticationResultToSessionResponse(types.AuthenticationResult{Tokens: tokens, Account: owner})
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.loggedIn", owner.ID.String(), now, events.UserLoggedInEventData{
			AccountId: owner.ID.String(), SessionId: session.SessionId.String(), Method: "messenger_trusted_device",
		})
	})
	if err != nil || !found {
		return nil, err
	}
	services.CancelPendingDeletionOnLogin(ctx, service.Container, owner.ID)
	return &CreateResult{Session: &response, TrustedDevice: &TrustedDeviceResponse{ID: deviceID.String(), Token: rotatedToken, ExpiresAt: tokenExpiry.UTC().Format(time.RFC3339)}}, nil
}

func (service Service) Status(ctx context.Context, authorizationID, proof string) (StatusResponse, error) {
	row, err := service.pendingByProof(ctx, authorizationID, proof)
	if err != nil {
		return StatusResponse{}, err
	}
	status := string(row.Status)
	if status == string(messengerauthorization.StatusPending) && !row.ExpiresAt.After(service.Now()) {
		status = "expired"
	}
	return StatusResponse{Status: status, ExpiresAt: row.ExpiresAt.UTC().Format(time.RFC3339), Device: DeviceContext{
		Name: row.DeviceName, Platform: string(row.Platform),
		RequestedAt: row.CreatedAt.UTC().Format(time.RFC3339), ApproximateLocation: nil,
	}}, nil
}

func (service Service) ListPendingAuthorizations(ctx context.Context, accountID string) (PendingAuthorizationsResponse, error) {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return PendingAuthorizationsResponse{}, authErrors.ErrInvalidRefreshToken
	}
	rows, err := service.Client.MessengerAuthorization.Query().Where(
		messengerauthorization.AccountID(owner),
		messengerauthorization.StatusEQ(messengerauthorization.StatusPending),
		messengerauthorization.ExpiresAtGT(service.Now()),
	).Order(ent.Desc(messengerauthorization.FieldCreatedAt)).Limit(50).All(ctx)
	if err != nil {
		return PendingAuthorizationsResponse{}, err
	}
	result := PendingAuthorizationsResponse{Authorizations: make([]PendingAuthorizationView, 0, len(rows))}
	for _, row := range rows {
		result.Authorizations = append(result.Authorizations, PendingAuthorizationView{
			ID: row.ID.String(), Status: string(row.Status),
			Device:    DeviceContext{Name: row.DeviceName, Platform: string(row.Platform), RequestedAt: row.CreatedAt.UTC().Format(time.RFC3339), ApproximateLocation: nil},
			ExpiresAt: row.ExpiresAt.UTC().Format(time.RFC3339),
		})
	}
	return result, nil
}
