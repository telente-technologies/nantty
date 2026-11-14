package messengerauth

import (
	"context"
	"crypto/subtle"
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
	"nantty/modules/auth/src/generated/ent/onetimecode"
	"nantty/modules/auth/src/generated/ent/session"
	sendonetimecode "nantty/modules/auth/src/modules/oneTimeCodes/commands/sendOneTimeCode"
	verifyonetimecode "nantty/modules/auth/src/modules/oneTimeCodes/commands/verifyOneTimeCode"
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

func (service Service) Approve(ctx context.Context, accountID, sessionID, authorizationID string) error {
	return service.setDecision(ctx, accountID, sessionID, authorizationID, "approved", "approve")
}

func (service Service) Deny(ctx context.Context, accountID, sessionID, authorizationID string) error {
	return service.setDecision(ctx, accountID, sessionID, authorizationID, "denied", "deny")
}

func (service Service) setDecision(ctx context.Context, accountID, sessionID, authorizationID, nextStatus, method string) error {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidAuthorization
	}
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return errInvalidAuthorization
	}
	var username string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(id), messengerauthorization.AccountID(owner),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		if !row.ExpiresAt.After(service.Now()) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		accountRecord, err := tx.Account.Get(ctx, owner)
		if err != nil {
			return err
		}
		username = accountRecord.Username
		update := row.Update().SetStatus(messengerauthorization.Status(nextStatus)).SetApprovalMethod(method).SetApprovedBySessionID(uuid.MustParse(sessionID))
		return update.Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner, username, "messenger.login_authorization."+method+"d", map[string]any{"authorizationId": id.String(), "sessionId": sessionID})
	}
	return err
}

func (service Service) IssueCode(ctx context.Context, accountID, sessionID, authorizationID string) (CodeResponse, error) {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return CodeResponse{}, errInvalidAuthorization
	}
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return CodeResponse{}, errInvalidAuthorization
	}
	code, err := utils.GenerateSixDigitOneTimeCode()
	if err != nil {
		return CodeResponse{}, err
	}
	now := service.Now()
	var username string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(id), messengerauthorization.AccountID(owner),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		if !row.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		if row.CodeIssuedAt != nil && now.Sub(*row.CodeIssuedAt) < codeResendCooldown {
			return errCodeCooldown
		}
		accountRecord, err := tx.Account.Get(ctx, owner)
		if err != nil {
			return err
		}
		username = accountRecord.Username
		return row.Update().SetCodeHash(utils.HashOneTimeCodeWithPepper(service.Settings.OneTimeCodePepper, id.String(), "messenger_authorization", code)).
			SetCodeIssuedAt(now).SetCodeExpiresAt(minTime(row.ExpiresAt, now.Add(authorizationCodeTTL))).SetCodeAttempts(0).
			SetApprovalMethod("code").SetApprovedBySessionID(uuid.MustParse(sessionID)).Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner, username, "messenger.login_authorization.code_issued", map[string]any{"authorizationId": id.String(), "sessionId": sessionID})
	}
	if err != nil {
		return CodeResponse{}, err
	}
	return CodeResponse{AuthorizationID: id.String(), Code: code, ExpiresAt: minTime(now.Add(authorizationCodeTTL), now.Add(authorizationTTL)).UTC().Format(time.RFC3339)}, nil
}

func (service Service) VerifyCode(ctx context.Context, authorizationID, proof, code string) error {
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return errInvalidAuthorization
	}
	proofHash := utils.HashOpaqueTokenForStorage(proof)
	var outcome error
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(messengerauthorization.ID(id), messengerauthorization.ProofHash(proofHash)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		now := service.Now()
		if !row.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			if row.Status == messengerauthorization.StatusDenied {
				return errAuthorizationDenied
			}
			return errAuthorizationState
		}
		if row.CodeAttempts >= maxCodeAttempts {
			outcome = errCodeAttempts
			return row.Update().SetStatus(messengerauthorization.StatusDenied).ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
		}
		if row.CodeHash == nil || row.CodeExpiresAt == nil || !row.CodeExpiresAt.After(now) {
			return errCodeInvalid
		}
		expected := utils.HashOneTimeCodeWithPepper(service.Settings.OneTimeCodePepper, id.String(), "messenger_authorization", code)
		if subtle.ConstantTimeCompare([]byte(expected), []byte(*row.CodeHash)) != 1 {
			attempts := row.CodeAttempts + 1
			update := row.Update().SetCodeAttempts(attempts)
			if attempts >= maxCodeAttempts {
				update.SetStatus(messengerauthorization.StatusDenied).ClearCodeHash().ClearCodeExpiresAt()
			}
			if err := update.Exec(ctx); err != nil {
				return err
			}
			if attempts >= maxCodeAttempts {
				outcome = errCodeAttempts
			} else {
				outcome = errCodeInvalid
			}
			return nil
		}
		return row.Update().SetStatus(messengerauthorization.StatusApproved).SetApprovalMethod("code").ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
	})
	if err != nil {
		return err
	}
	return outcome
}

func (service Service) SendRecoveryEmail(ctx context.Context, authorizationID, proof string) (RecoveryEmailResponse, error) {
	row, err := service.pendingByProof(ctx, authorizationID, proof)
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	if !row.ExpiresAt.After(service.Now()) {
		return RecoveryEmailResponse{}, errAuthorizationExpired
	}
	if row.Status != messengerauthorization.StatusPending {
		return RecoveryEmailResponse{}, errAuthorizationState
	}
	owner, err := service.Client.Account.Get(ctx, row.AccountID)
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	if (owner.Status != account.StatusActive && owner.Status != account.StatusSuspended) || owner.Email == nil || owner.EmailVerifiedAt == nil {
		return RecoveryEmailResponse{}, errRecoveryUnavailable
	}
	result, err := (sendonetimecode.Handler{Container: service.Container}).Execute(ctx, sendonetimecode.Command{
		Destination: *owner.Email, Purpose: string(onetimecode.PurposeLogin),
	})
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	return RecoveryEmailResponse{Status: "sent", DestinationHint: maskEmail(*owner.Email), ExpiresIn: result.ExpiresIn}, nil
}

func (service Service) VerifyRecoveryEmail(ctx context.Context, authorizationID, proof, code string) error {
	row, err := service.pendingByProof(ctx, authorizationID, proof)
	if err != nil {
		return err
	}
	if !row.ExpiresAt.After(service.Now()) {
		return errAuthorizationExpired
	}
	if row.Status != messengerauthorization.StatusPending {
		return errAuthorizationState
	}
	owner, err := service.Client.Account.Get(ctx, row.AccountID)
	if err != nil {
		return err
	}
	if (owner.Status != account.StatusActive && owner.Status != account.StatusSuspended) || owner.Email == nil || owner.EmailVerifiedAt == nil {
		return errRecoveryUnavailable
	}
	verified, err := (verifyonetimecode.Handler{Container: service.Container}).Execute(ctx, verifyonetimecode.Command{
		Destination: *owner.Email, Code: code, Purpose: string(onetimecode.PurposeLogin),
	})
	if err != nil {
		return err
	}
	authorizationUUID, _ := uuid.Parse(authorizationID)
	proofHash := utils.HashOpaqueTokenForStorage(proof)
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(authorizationUUID), messengerauthorization.ProofHash(proofHash),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		now := service.Now()
		if !locked.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if locked.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		verifiedEmail, err := services.ConsumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeLoginVerified, verified.OtpToken, service.Now)
		if err != nil || verifiedEmail != *owner.Email {
			return errRecoveryUnavailable
		}
		return locked.Update().SetStatus(messengerauthorization.StatusApproved).SetApprovalMethod("email_recovery").ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner.ID, owner.Username, "messenger.login_authorization.email_recovery_verified", map[string]any{"authorizationId": authorizationUUID.String()})
	}
	return err
}

func maskEmail(email string) string {
	local, domain, found := strings.Cut(email, "@")
	if !found || local == "" {
		return ""
	}
	return local[:1] + "***@" + domain
}

func (service Service) Complete(ctx context.Context, authorizationID, proof string) (types.AuthSessionResponse, TrustedDeviceResponse, error) {
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return types.AuthSessionResponse{}, TrustedDeviceResponse{}, errInvalidAuthorization
	}
	proofHash := utils.HashOpaqueTokenForStorage(proof)
	trustedToken, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return types.AuthSessionResponse{}, TrustedDeviceResponse{}, err
	}
	now := service.Now()
	var authResponse types.AuthSessionResponse
	var trustedID uuid.UUID
	var expiry time.Time
	var ownerID uuid.UUID
	var username string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(messengerauthorization.ID(id), messengerauthorization.ProofHash(proofHash)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		if !row.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if row.Status == messengerauthorization.StatusDenied {
			return errAuthorizationDenied
		}
		if row.Status != messengerauthorization.StatusApproved {
			return errAuthorizationState
		}
		owner, err := tx.Account.Query().Where(account.ID(row.AccountID), account.StatusIn(account.StatusActive, account.StatusSuspended)).Only(ctx)
		if ent.IsNotFound(err) {
			return authErrors.ErrInvalidCredentials
		}
		if err != nil {
			return err
		}
		ownerID, username = owner.ID, owner.Username
		session, err := services.StartSessionWithDeviceHashInTransaction(ctx, service.Container, tx, owner.ID,
			types.ClientDetails{UserAgent: row.UserAgent, IpAddress: row.IPAddress}, row.InstallationHash)
		if err != nil {
			return err
		}
		tokens, err := services.SignAccessTokenAndBuildIssuedTokens(service.Container, owner, session.SessionId, session.RefreshToken)
		if err != nil {
			return err
		}
		trustedID = uuid.New()
		expiry = now.Add(trustedDeviceTTL)
		if err := tx.MessengerTrustedDevice.Create().
			SetID(trustedID).SetAccountID(owner.ID).SetTokenHash(utils.HashOpaqueTokenForStorage(trustedToken)).
			SetInstallationHash(row.InstallationHash).SetPlatform(messengertrusteddevice.Platform(row.Platform)).SetDeviceName(row.DeviceName).
			SetUserAgent(row.UserAgent).SetLastUsedAt(now).SetExpiresAt(expiry).Exec(ctx); err != nil {
			return err
		}
		authResponse = types.ConvertAuthenticationResultToSessionResponse(types.AuthenticationResult{Tokens: tokens, Account: owner})
		if err := row.Update().SetStatus(messengerauthorization.StatusCompleted).SetCompletedAt(now).SetCompletedSessionID(session.SessionId).ClearCodeHash().ClearCodeExpiresAt().Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.loggedIn", owner.ID.String(), now, events.UserLoggedInEventData{
			AccountId: owner.ID.String(), SessionId: session.SessionId.String(), Method: "messenger_authorization",
		})
	})
	if err != nil {
		return types.AuthSessionResponse{}, TrustedDeviceResponse{}, err
	}
	services.CancelPendingDeletionOnLogin(ctx, service.Container, ownerID)
	services.RecordAccountSecurityEvent(ctx, service.Container, ownerID, username, "messenger.login_authorization.completed", map[string]any{"authorizationId": id.String(), "trustedDeviceId": trustedID.String()})
	return authResponse, TrustedDeviceResponse{ID: trustedID.String(), Token: trustedToken, ExpiresAt: expiry.UTC().Format(time.RFC3339)}, nil
}

func (service Service) ListDevices(ctx context.Context, accountID string) ([]TrustedDeviceView, error) {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return nil, authErrors.ErrInvalidRefreshToken
	}
	rows, err := service.Client.MessengerTrustedDevice.Query().Where(
		messengertrusteddevice.AccountID(owner), messengertrusteddevice.RevokedAtIsNil(), messengertrusteddevice.ExpiresAtGT(service.Now()),
	).Order(ent.Desc(messengertrusteddevice.FieldLastUsedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]TrustedDeviceView, 0, len(rows))
	for _, row := range rows {
		result = append(result, TrustedDeviceView{ID: row.ID.String(), Platform: string(row.Platform), DeviceName: row.DeviceName,
			CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), LastUsedAt: row.LastUsedAt.UTC().Format(time.RFC3339), ExpiresAt: row.ExpiresAt.UTC().Format(time.RFC3339)})
	}
	return result, nil
}

func (service Service) RevokeDevice(ctx context.Context, accountID, deviceID string) error {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return authErrors.ErrInvalidRefreshToken
	}
	id, err := uuid.Parse(deviceID)
	if err != nil {
		return authErrors.ErrSessionNotFound
	}
	var installationHash string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		device, err := tx.MessengerTrustedDevice.Query().Where(messengertrusteddevice.ID(id), messengertrusteddevice.AccountID(owner), messengertrusteddevice.RevokedAtIsNil()).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return authErrors.ErrSessionNotFound
		}
		if err != nil {
			return err
		}
		installationHash = device.InstallationHash
		now := service.Now()
		if err := device.Update().SetRevokedAt(now).Exec(ctx); err != nil {
			return err
		}
		sessions, err := tx.Session.Query().Where(session.AccountID(owner), session.DeviceHash(installationHash), session.RevokedAtIsNil()).All(ctx)
		if err != nil {
			return err
		}
		for _, active := range sessions {
			if err := active.Update().SetRevokedAt(now).SetRevokedReason(session.RevokedReasonLogout).Exec(ctx); err != nil {
				return err
			}
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "session.revoked", owner.String(), now, events.SessionRevokedEventData{AccountId: owner.String(), SessionId: active.ID.String(), Reason: "logout"}); err != nil {
				return err
			}
		}
		return nil
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner, "", "messenger.trusted_device.revoked", map[string]any{"deviceId": id.String()})
	}
	return err
}

func (service Service) pendingByProof(ctx context.Context, authorizationID, proof string) (*ent.MessengerAuthorization, error) {
	id, err := uuid.Parse(authorizationID)
	if err != nil || proof == "" {
		return nil, errInvalidAuthorization
	}
	row, err := service.Client.MessengerAuthorization.Query().Where(
		messengerauthorization.ID(id), messengerauthorization.ProofHash(utils.HashOpaqueTokenForStorage(proof)),
	).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errInvalidAuthorization
	}
	return row, err
}

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}
