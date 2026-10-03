package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffsession"
	"zudomart/platform/identityports"
)

func (application *AdminApplication) RotateStaffRefreshTokenAndDetectReuse(ctx context.Context, presented string) (StaffSessionResult, error) {
	var rejection error
	var staff *ent.StaffAccount
	var sessionId uuid.UUID
	var nextRefreshToken string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		presentedHash := hashOpaqueTokenForStorage(presented)
		current, err := tx.StaffSession.Query().Where(staffsession.RefreshHash(presentedHash)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = errInvalidRefreshToken
			return application.revokeSessionHoldingPreviousRefreshHashInTransaction(ctx, tx, presentedHash, now, &rejection)
		}
		if err != nil {
			return err
		}
		if current.RevokedAt != nil || !current.ExpiresAt.After(now) || !current.CreatedAt.Add(absoluteSessionLifetime).After(now) {
			rejection = errInvalidRefreshToken
			return nil
		}
		staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(current.StaffID), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
		if ent.IsNotFound(err) {
			rejection = errInvalidRefreshToken
			return current.Update().SetRevokedAt(now).Exec(ctx)
		}
		if err != nil {
			return err
		}
		if nextRefreshToken, err = generateOpaqueUrlSafeToken(); err != nil {
			return err
		}
		sessionId = current.ID
		return current.Update().SetPreviousRefreshHash(presentedHash).SetRefreshHash(hashOpaqueTokenForStorage(nextRefreshToken)).
			SetLastUsedAt(now).SetExpiresAt(now.Add(application.Settings.StaffRefreshTokenTtl)).Exec(ctx)
	})
	if err != nil {
		return StaffSessionResult{}, err
	}
	if rejection != nil {
		return StaffSessionResult{}, rejection
	}
	return application.buildSessionResult(staff, sessionId, nextRefreshToken)
}

func (application *AdminApplication) revokeSessionHoldingPreviousRefreshHashInTransaction(ctx context.Context, tx *ent.Tx, presentedHash string, now time.Time, rejection *error) error {
	reused, err := tx.StaffSession.Query().Where(staffsession.PreviousRefreshHash(presentedHash)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	*rejection = errRefreshTokenReused
	if reused.RevokedAt != nil {
		return nil
	}
	if err := reused.Update().SetRevokedAt(now).Exec(ctx); err != nil {
		return err
	}
	application.Logger.WarnContext(ctx, "staff refresh token reuse detected; session revoked", "sessionId", reused.ID.String())
	return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
		ActorId: reused.StaffID.String(), Action: "staff.refresh_token_reuse_detected", SubjectType: "staff_session", SubjectId: reused.ID.String(),
	})
}
