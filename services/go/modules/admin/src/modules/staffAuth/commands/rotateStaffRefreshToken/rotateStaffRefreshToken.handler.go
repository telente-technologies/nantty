package rotatestaffrefreshtoken

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/modules/staffAuth/models"
	"nantty/modules/admin/src/modules/staffAuth/services"
	"nantty/modules/admin/src/repositories"
	"nantty/modules/admin/src/types"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.StaffSessionResult, error) {
	var rejection error
	var staff *ent.StaffAccount
	var sessionId uuid.UUID
	var nextRefreshToken string
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		presentedHash := secrettokens.HashOpaqueTokenForStorage(command.RefreshToken)
		current, err := tx.StaffSession.Query().Where(staffsession.RefreshHash(presentedHash)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = adminerrors.InvalidRefreshToken
			return handler.revokeSessionHoldingPreviousRefreshHash(ctx, tx, presentedHash, now, &rejection)
		}
		if err != nil {
			return err
		}
		if current.RevokedAt != nil || !current.ExpiresAt.After(now) {
			rejection = adminerrors.InvalidRefreshToken
			return nil
		}
		if !current.CreatedAt.Add(services.AbsoluteSessionLifetime).After(now) || !current.LastUsedAt.Add(services.IdleSessionLifetime).After(now) {
			rejection = adminerrors.InvalidRefreshToken
			return current.Update().SetRevokedAt(now).Exec(ctx)
		}
		staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(current.StaffID), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
		if ent.IsNotFound(err) {
			rejection = adminerrors.InvalidRefreshToken
			return current.Update().SetRevokedAt(now).Exec(ctx)
		}
		if err != nil {
			return err
		}
		if !(services.StaffAuthService{Container: handler.Container}).StaffAddressAllowed(staff, types.ClientDetailsFromContext(ctx).IpAddress) {
			rejection = adminerrors.IpNotAllowed
			return nil
		}
		if nextRefreshToken, err = secrettokens.GenerateOpaqueUrlSafeToken(); err != nil {
			return err
		}
		sessionId = current.ID
		return current.Update().SetPreviousRefreshHash(presentedHash).SetRefreshHash(secrettokens.HashOpaqueTokenForStorage(nextRefreshToken)).
			SetLastUsedAt(now).SetExpiresAt(now.Add(handler.Container.Settings.StaffRefreshTokenTtl)).Exec(ctx)
	})
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	if rejection != nil {
		return models.StaffSessionResult{}, rejection
	}
	return services.StaffAuthService{Container: handler.Container}.BuildSessionResult(ctx, staff, sessionId, nextRefreshToken)
}

func (handler Handler) revokeSessionHoldingPreviousRefreshHash(ctx context.Context, tx *ent.Tx, presentedHash string, now time.Time, rejection *error) error {
	reused, err := tx.StaffSession.Query().Where(staffsession.PreviousRefreshHash(presentedHash)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	*rejection = adminerrors.RefreshTokenReused
	if reused.RevokedAt != nil {
		return nil
	}
	if err := reused.Update().SetRevokedAt(now).Exec(ctx); err != nil {
		return err
	}
	handler.Container.Logger.WarnContext(ctx, "staff refresh token reuse detected; session revoked", "sessionId", reused.ID.String())
	return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
		ActorId: reused.StaffID.String(), Action: "staff.refresh_token_reuse_detected", SubjectType: "staff_session", SubjectId: reused.ID.String(),
	})
}
