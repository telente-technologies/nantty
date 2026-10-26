package createadmin

import (
	"context"
	"slices"
	"strings"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	adminevents "nantty/modules/admin/src/events"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	staffevents "nantty/modules/admin/src/modules/staffAdmins/events"
	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/repositories"
	"nantty/modules/admin/src/types"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	email, valid := secrettokens.NormalizeStaffEmail(command.Email)
	if !valid {
		return Result{}, adminerrors.ValidationFailedFor("email", "must be a valid email address")
	}
	if domains := handler.Container.Settings.AllowedEmailDomains; len(domains) > 0 && !slices.Contains(domains, email[strings.LastIndex(email, "@")+1:]) {
		return Result{}, adminerrors.ValidationFailedFor("email", "must use an approved work domain")
	}
	permissions, err := services.NormalizePermissions(command.Permissions)
	if err != nil {
		return Result{}, err
	}
	role := services.ParseStaffRole(command.Role)
	name := types.TruncateToLength(strings.TrimSpace(command.Name), 80)
	reason := strings.TrimSpace(command.Reason)
	invitationToken, err := secrettokens.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return Result{}, err
	}
	var created *ent.StaffAccount
	var invited bool
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if err := acting.RequireStaffManagement(); err != nil {
			return err
		}
		if role == staffaccount.RoleSuperadmin {
			if !acting.IsSuperadmin() {
				return adminerrors.Forbidden("ADMINS_CANNOT_CREATE_SUPERADMINS", "Only superadmins can create superadmins.")
			}
			permissions = []string{}
		}
		roleIds, roles, err := services.ResolveRoleIdentifiersInTransaction(ctx, tx, command.RoleIds)
		if err != nil {
			return err
		}
		if err := acting.AssertGrantable(services.EffectivePermissionsOfDraft(permissions, roles)); err != nil {
			return err
		}
		if taken, err := tx.StaffAccount.Query().Where(staffaccount.Email(email)).Exist(ctx); err != nil || taken {
			return adminerrors.FirstError(err, adminerrors.EmailAlreadyInUse)
		}
		status := staffaccount.StatusInvited
		if role == staffaccount.RoleSuperadmin && services.SecondSuperadminApprovalRequired(ctx, tx.Client()) {
			status = staffaccount.StatusPendingApproval
		}
		now := handler.Container.Now()
		if created, err = tx.StaffAccount.Create().SetEmail(email).SetDisplayName(name).SetRole(role).SetStatus(status).SetRoleIds(roleIds).SetPermissions(permissions).SetCreatedBy(acting.Account.ID).Save(ctx); err != nil {
			return err
		}
		if invited = status == staffaccount.StatusInvited; invited {
			if err := services.CreateInvitationInTransaction(ctx, tx, created.ID, invitationToken, now.Add(handler.Container.Settings.InvitationTtl)); err != nil {
				return err
			}
			if err := adminevents.EnqueueOutboxEventInTransaction(ctx, tx, "staff.invited", created.ID.String(), now, staffevents.StaffInvitedEventData{
				StaffId: created.ID.String(), Email: email, Role: string(created.Role), InvitedBy: acting.Account.ID.String(),
			}); err != nil {
				return err
			}
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "admin.created", SubjectType: "staff", SubjectId: created.ID.String(), SubjectLabel: email,
			After:  jsonencoding.MustMarshalJson(map[string]any{"email": email, "role": role, "status": status, "roleIds": roleIds, "permissions": permissions}),
			Reason: reason, StepUpVerified: command.Actor.SteppedUp,
		})
	})
	if err != nil {
		return Result{}, err
	}
	views, err := services.BuildStaffViews(ctx, handler.Container.Client, []*ent.StaffAccount{created})
	if err != nil {
		return Result{}, err
	}
	result := Result{Admin: views[0], InvitationExpiresInHours: int(handler.Container.Settings.InvitationTtl.Hours())}
	if invited {
		result.InvitationSentTo = &email
		err = handler.Container.Delivery.DeliverStaffInvitation(ctx, email, name, invitationToken)
	}
	return result, err
}
