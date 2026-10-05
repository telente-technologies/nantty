package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	"zudomart/modules/admin/src/generated/ent/staffwebauthncredential"
	"zudomart/modules/admin/src/repositories"
	"zudomart/modules/admin/src/types"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

const (
	AccessActionDisable  = "disable"
	AccessActionEnable   = "enable"
	AccessActionSuspend  = "suspend"
	AccessActionRevoke   = "revoke"
	AccessActionResetMfa = "reset_mfa"
)

var auditActionByAccessAction = map[string]string{
	AccessActionDisable: "admin.disable", AccessActionEnable: "admin.enable", AccessActionSuspend: "admin.access_suspended",
	AccessActionRevoke: "admin.access_revoked", AccessActionResetMfa: "admin.reset_mfa",
}

func ChangeStaffAccess(ctx context.Context, application *container.Container, actor staffauth.Staff, targetId, action, reason string) (types.StaffView, error) {
	target, err := uuid.Parse(targetId)
	if err != nil {
		return types.StaffView{}, adminerrors.StaffNotFound
	}
	var updated *ent.StaffAccount
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := LoadActingStaffInTransaction(ctx, tx, actor)
		if err != nil {
			return err
		}
		if err := acting.RequireStaffManagement(); err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if err := acting.AssertCanActOn(existing, action == AccessActionResetMfa); err != nil {
			return err
		}
		update, err := planAccessUpdate(ctx, tx, existing, action)
		if err != nil {
			return err
		}
		if updated, err = update.Save(ctx); err != nil {
			return err
		}
		if action != AccessActionEnable {
			if _, err := tx.StaffSession.Update().Where(staffsession.StaffID(target), staffsession.RevokedAtIsNil()).SetRevokedAt(application.Now()).Save(ctx); err != nil {
				return err
			}
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: auditActionByAccessAction[action], SubjectType: "staff", SubjectId: target.String(), SubjectLabel: existing.Email,
			Before: jsonencoding.MustMarshalJson(map[string]any{"status": existing.Status, "mfaEnrolled": existing.TotpConfirmedAt != nil}),
			After:  jsonencoding.MustMarshalJson(map[string]any{"status": updated.Status, "mfaEnrolled": updated.TotpConfirmedAt != nil}),
			Reason: strings.TrimSpace(reason), StepUpVerified: actor.SteppedUp,
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	return BuildSingleStaffView(ctx, application, updated)
}

func planAccessUpdate(ctx context.Context, tx *ent.Tx, existing *ent.StaffAccount, action string) (*ent.StaffAccountUpdateOne, error) {
	update := existing.Update()
	switch action {
	case AccessActionResetMfa:
		if _, err := tx.StaffWebauthnCredential.Delete().Where(staffwebauthncredential.StaffID(existing.ID)).Exec(ctx); err != nil {
			return nil, err
		}
		return update.ClearTotpSecretEncrypted().ClearTotpConfirmedAt().SetTotpLastUsedStep(0).SetRecoveryCodeHashes([]string{}), nil
	case AccessActionEnable:
		if existing.Status == staffaccount.StatusRevoked {
			return nil, adminerrors.Conflict("ACCESS_REVOKED", "Revoked access cannot be restored.")
		}
		next := staffaccount.StatusActive
		if existing.PasswordHash == nil {
			next = staffaccount.StatusInvited
		}
		return update.SetStatus(next).SetFailedAttempts(0).ClearLockedUntil(), nil
	}
	if existing.Status == staffaccount.StatusRevoked {
		return nil, adminerrors.Conflict("ACCESS_REVOKED", "Revoked access cannot be changed.")
	}
	if existing.Role == staffaccount.RoleSuperadmin {
		others, err := tx.StaffAccount.Query().Where(staffaccount.RoleEQ(staffaccount.RoleSuperadmin), staffaccount.StatusEQ(staffaccount.StatusActive), staffaccount.IDNEQ(existing.ID)).Exist(ctx)
		if err != nil {
			return nil, err
		}
		if !others && existing.Status == staffaccount.StatusActive {
			return nil, adminerrors.Conflict("LAST_SUPERADMIN", "At least one superadmin must stay active.")
		}
	}
	switch action {
	case AccessActionDisable:
		return update.SetStatus(staffaccount.StatusDisabled), nil
	case AccessActionSuspend:
		return update.SetStatus(staffaccount.StatusSuspended), nil
	}
	return update.SetStatus(staffaccount.StatusRevoked), nil
}
