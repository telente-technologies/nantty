package application

import (
	"context"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffsession"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

const maximumPermissionsPerStaff = 40

var permissionPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$`)

type StaffInvitedEventData struct {
	StaffId   string `json:"staffId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	InvitedBy string `json:"invitedBy"`
}

type InviteStaffInput struct {
	Email       string
	DisplayName string
	Permissions []string
}

func NormalizePermissions(raw []string) ([]string, error) {
	unique := map[string]bool{}
	for _, permission := range raw {
		trimmed := strings.TrimSpace(permission)
		if !permissionPattern.MatchString(trimmed) {
			return nil, unprocessable("Permissions look like admin.config.read.")
		}
		unique[trimmed] = true
	}
	if len(unique) > maximumPermissionsPerStaff {
		return nil, unprocessable("Too many permissions.")
	}
	normalized := make([]string, 0, len(unique))
	for permission := range unique {
		normalized = append(normalized, permission)
	}
	slices.Sort(normalized)
	return normalized, nil
}

func (application *AdminApplication) requireActiveSuperadminInTransaction(ctx context.Context, tx *ent.Tx, actor staffauth.Staff) (*ent.StaffAccount, error) {
	actorId, err := uuid.Parse(actor.Id)
	if err != nil {
		return nil, errSuperadminRequired
	}
	found, err := tx.StaffAccount.Query().Where(staffaccount.ID(actorId), staffaccount.StatusEQ(staffaccount.StatusActive), staffaccount.RoleEQ(staffaccount.RoleSuperadmin)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errSuperadminRequired
	}
	return found, err
}

func (application *AdminApplication) InviteAdminAsSuperadmin(ctx context.Context, actor staffauth.Staff, input InviteStaffInput) (StaffView, error) {
	email, valid := NormalizeStaffEmail(input.Email)
	if !valid {
		return StaffView{}, unprocessable("Enter a valid email address.")
	}
	permissions, err := NormalizePermissions(input.Permissions)
	if err != nil {
		return StaffView{}, err
	}
	displayName := truncateToLength(strings.TrimSpace(input.DisplayName), 80)
	invitationToken, err := generateOpaqueUrlSafeToken()
	if err != nil {
		return StaffView{}, err
	}
	var invited *ent.StaffAccount
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		inviter, err := application.requireActiveSuperadminInTransaction(ctx, tx, actor)
		if err != nil {
			return err
		}
		if taken, err := tx.StaffAccount.Query().Where(staffaccount.Email(email)).Exist(ctx); err != nil || taken {
			return firstError(err, errEmailAlreadyInUse)
		}
		now := application.Now()
		if invited, err = tx.StaffAccount.Create().SetEmail(email).SetDisplayName(displayName).SetRole(staffaccount.RoleAdmin).
			SetPermissions(permissions).SetCreatedBy(inviter.ID).Save(ctx); err != nil {
			return err
		}
		if err := tx.StaffInvitation.Create().SetStaffID(invited.ID).SetTokenHash(hashOpaqueTokenForStorage(invitationToken)).
			SetExpiresAt(now.Add(application.Settings.InvitationTtl)).Exec(ctx); err != nil {
			return err
		}
		if err := enqueueOutboxEventInTransaction(ctx, tx, "staff.invited", invited.ID.String(), now, StaffInvitedEventData{
			StaffId: invited.ID.String(), Email: email, Role: string(invited.Role), InvitedBy: inviter.ID.String(),
		}); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: inviter.ID.String(), ActorRole: string(inviter.Role), Action: "staff.invited", SubjectType: "staff", SubjectId: invited.ID.String(),
			After: mustMarshalJson(map[string]any{"email": email, "permissions": permissions}),
		})
	})
	if err != nil {
		return StaffView{}, err
	}
	return ConvertStaffToView(invited), application.Delivery.DeliverStaffInvitation(ctx, email, displayName, invitationToken)
}

func (application *AdminApplication) ChangeAdminPermissionsAsSuperadmin(ctx context.Context, actor staffauth.Staff, targetId string, rawPermissions []string) (StaffView, error) {
	target, err := uuid.Parse(targetId)
	if err != nil {
		return StaffView{}, errStaffNotFound
	}
	permissions, err := NormalizePermissions(rawPermissions)
	if err != nil {
		return StaffView{}, err
	}
	var updated *ent.StaffAccount
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		changer, err := application.requireActiveSuperadminInTransaction(ctx, tx, actor)
		if err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target), staffaccount.RoleEQ(staffaccount.RoleAdmin)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errStaffNotFound
		}
		if err != nil {
			return err
		}
		if updated, err = existing.Update().SetPermissions(permissions).Save(ctx); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: changer.ID.String(), ActorRole: string(changer.Role), Action: "staff.permissions_changed", SubjectType: "staff", SubjectId: target.String(),
			Before: mustMarshalJson(existing.Permissions), After: mustMarshalJson(permissions),
		})
	})
	if err != nil {
		return StaffView{}, err
	}
	return ConvertStaffToView(updated), nil
}

func (application *AdminApplication) DisableAdminAsSuperadmin(ctx context.Context, actor staffauth.Staff, targetId string) error {
	target, err := uuid.Parse(targetId)
	if err != nil {
		return errStaffNotFound
	}
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		disabler, err := application.requireActiveSuperadminInTransaction(ctx, tx, actor)
		if err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target), staffaccount.RoleEQ(staffaccount.RoleAdmin)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) || target == disabler.ID {
			return errStaffNotFound
		}
		if err != nil {
			return err
		}
		if err := existing.Update().SetStatus(staffaccount.StatusDisabled).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.StaffSession.Update().Where(staffsession.StaffID(target), staffsession.RevokedAtIsNil()).SetRevokedAt(application.Now()).Save(ctx); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: disabler.ID.String(), ActorRole: string(disabler.Role), Action: "staff.disabled", SubjectType: "staff", SubjectId: target.String(),
		})
	})
}
