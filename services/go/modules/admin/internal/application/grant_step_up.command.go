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

type StepUpResult struct {
	StepUpToken string `json:"stepUpToken"`
	ExpiresIn   int    `json:"expiresIn"`
}

func (application *AdminApplication) GrantStepUpAuthorization(ctx context.Context, staffId, sessionId, code string) (StepUpResult, error) {
	staffUuid, staffErr := uuid.Parse(staffId)
	sessionUuid, sessionErr := uuid.Parse(sessionId)
	if staffErr != nil || sessionErr != nil {
		return StepUpResult{}, errInvalidRefreshToken
	}
	var rejection error
	var staff *ent.StaffAccount
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		if live, err := tx.StaffSession.Query().Where(staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(now)).Exist(ctx); err != nil || !live {
			rejection = errInvalidRefreshToken
			return err
		}
		var err error
		if staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(staffUuid), staffaccount.StatusEQ(staffaccount.StatusActive)).ForUpdate().Only(ctx); err != nil {
			rejection = errInvalidRefreshToken
			return ignoreNotFound(err)
		}
		if staff.LockedUntil != nil && staff.LockedUntil.After(now) {
			rejection = errTooManyMfaAttempts
			return nil
		}
		step, matched, err := application.checkTotpCodeAgainstStaff(staff, code, now)
		if err != nil {
			rejection = err
			return nil
		}
		if !matched {
			rejection = errInvalidMfaCode
			return application.countFailedStepUpInTransaction(ctx, tx, staff, &rejection)
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpLastUsedStep(step).SetFailedAttempts(0).Exec(ctx); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: "staff.step_up_granted", SubjectType: "staff", SubjectId: staff.ID.String(),
		})
	})
	if err != nil {
		return StepUpResult{}, err
	}
	if rejection != nil {
		return StepUpResult{}, rejection
	}
	tokens, err := application.Tokens()
	if err != nil {
		return StepUpResult{}, err
	}
	token, err := tokens.SignStaffStepUpToken(claimsForStaff(staff, sessionUuid), application.Settings.StepUpTtl)
	return StepUpResult{StepUpToken: token, ExpiresIn: int(application.Settings.StepUpTtl / time.Second)}, err
}

func (application *AdminApplication) countFailedStepUpInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount, rejection *error) error {
	attempts := staff.FailedAttempts + 1
	update := tx.StaffAccount.UpdateOneID(staff.ID)
	if attempts >= application.Settings.MaximumFailedPasswords {
		*rejection = errTooManyMfaAttempts
		return update.SetFailedAttempts(0).SetLockedUntil(application.Now().Add(application.Settings.LockoutDuration)).Exec(ctx)
	}
	return update.SetFailedAttempts(attempts).Exec(ctx)
}

func ignoreNotFound(err error) error {
	if ent.IsNotFound(err) {
		return nil
	}
	return err
}
