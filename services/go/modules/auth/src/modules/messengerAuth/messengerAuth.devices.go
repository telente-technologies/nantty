package messengerauth

import (
	"context"
	"time"

	"github.com/google/uuid"

	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/generated/ent/messengerauthorization"
	"nantty/modules/auth/src/generated/ent/messengertrusteddevice"
	"nantty/modules/auth/src/generated/ent/session"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
)

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
