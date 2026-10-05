package grantstepup

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/modules/staffAuth/services"
	"zudomart/modules/admin/src/repositories"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.StepUpResult, error) {
	staffId, staffErr := uuid.Parse(command.StaffId)
	sessionId, sessionErr := uuid.Parse(command.SessionId)
	if staffErr != nil || sessionErr != nil {
		return models.StepUpResult{}, adminerrors.InvalidRefreshToken
	}
	service := services.StaffAuthService{Container: handler.Container}
	var rejection error
	var staff *ent.StaffAccount
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		session, err := tx.StaffSession.Query().Where(staffsession.ID(sessionId), staffsession.StaffID(staffId), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if err != nil {
			rejection = adminerrors.InvalidRefreshToken
			if ent.IsNotFound(err) {
				return nil
			}
			return err
		}
		if staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(staffId), staffaccount.StatusEQ(staffaccount.StatusActive)).ForUpdate().Only(ctx); err != nil {
			rejection = adminerrors.InvalidRefreshToken
			if ent.IsNotFound(err) {
				return nil
			}
			return err
		}
		if staff.LockedUntil != nil && staff.LockedUntil.After(now) {
			rejection = adminerrors.TooManyMfaAttempts
			return nil
		}
		proof := services.SecondFactorProof{Method: command.Method, Code: command.Code, Credential: command.Credential}
		matched, err := service.VerifySecondFactorInTransaction(ctx, tx, staff, proof, pendingStepUpCeremony(session, now), now)
		if err != nil {
			if services.IsRejection(err) {
				rejection = err
				return nil
			}
			return err
		}
		if !matched {
			rejection = adminerrors.InvalidMfaCode
			lockedOut, err := service.CountFailedStepUpInTransaction(ctx, tx, staff)
			if lockedOut {
				rejection = adminerrors.TooManyMfaAttempts
			}
			return err
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetFailedAttempts(0).Exec(ctx); err != nil {
			return err
		}
		if err := session.Update().ClearWebauthnSession().ClearWebauthnCeremony().ClearWebauthnExpiresAt().Exec(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: "staff.step_up_granted", SubjectType: "staff", SubjectId: staff.ID.String(),
			After: jsonencoding.MustMarshalJson(map[string]string{"method": proof.MethodName(), "sessionId": sessionId.String()}),
		})
	})
	if err != nil {
		return models.StepUpResult{}, err
	}
	if rejection != nil {
		return models.StepUpResult{}, rejection
	}
	tokens, err := handler.Container.Tokens()
	if err != nil {
		return models.StepUpResult{}, err
	}
	stepUpTtl := handler.Container.Settings.StepUpTtl
	token, err := tokens.SignStaffStepUpToken(services.ClaimsForStaff(staff, sessionId), stepUpTtl)
	return models.StepUpResult{StepUpToken: token, ExpiresIn: int(stepUpTtl / time.Second)}, err
}

func pendingStepUpCeremony(session *ent.StaffSession, now time.Time) []byte {
	if session.WebauthnCeremony == nil || *session.WebauthnCeremony != staffsession.WebauthnCeremonyStepUp || session.WebauthnExpiresAt == nil || !session.WebauthnExpiresAt.After(now) {
		return nil
	}
	return session.WebauthnSession
}
