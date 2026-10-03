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
		live, err := tx.StaffSession.Query().Where(staffsession.ID(sessionId), staffsession.StaffID(staffId), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(now)).Exist(ctx)
		if err != nil || !live {
			rejection = adminerrors.InvalidRefreshToken
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
		step, matched, err := service.CheckTotpCodeAgainstStaff(staff, command.Code, now)
		if err != nil {
			rejection = err
			return nil
		}
		if !matched {
			rejection = adminerrors.InvalidMfaCode
			lockedOut, err := service.CountFailedStepUpInTransaction(ctx, tx, staff)
			if lockedOut {
				rejection = adminerrors.TooManyMfaAttempts
			}
			return err
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpLastUsedStep(step).SetFailedAttempts(0).Exec(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: "staff.step_up_granted", SubjectType: "staff", SubjectId: staff.ID.String(),
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
