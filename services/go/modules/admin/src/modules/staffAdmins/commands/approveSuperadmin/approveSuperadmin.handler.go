package approvesuperadmin

import (
	"context"
	"strings"

	"github.com/google/uuid"

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

func (handler Handler) Execute(ctx context.Context, command Command) (types.StaffView, error) {
	target, err := uuid.Parse(command.TargetId)
	if err != nil {
		return types.StaffView{}, adminerrors.StaffNotFound
	}
	token, err := secrettokens.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return types.StaffView{}, err
	}
	var approved *ent.StaffAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if err := acting.RequireSuperadmin(); err != nil {
			return err
		}
		pending, err := tx.StaffAccount.Query().Where(staffaccount.ID(target)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if pending.Status != staffaccount.StatusPendingApproval {
			return adminerrors.Conflict("NOT_PENDING", "This account is not waiting for approval.")
		}
		if pending.CreatedBy != nil && *pending.CreatedBy == acting.Account.ID {
			return adminerrors.Conflict("SAME_SUPERADMIN", "A different superadmin must approve this account.")
		}
		now := handler.Container.Now()
		if approved, err = pending.Update().SetStatus(staffaccount.StatusInvited).SetApprovedBy(acting.Account.ID).SetApprovedAt(now).Save(ctx); err != nil {
			return err
		}
		if err := services.CreateInvitationInTransaction(ctx, tx, target, token, now.Add(handler.Container.Settings.InvitationTtl)); err != nil {
			return err
		}
		if err := adminevents.EnqueueOutboxEventInTransaction(ctx, tx, "staff.invited", target.String(), now, staffevents.StaffInvitedEventData{
			StaffId: target.String(), Email: pending.Email, Role: string(pending.Role), InvitedBy: acting.Account.ID.String(),
		}); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "admin.superadmin_approved", SubjectType: "staff", SubjectId: target.String(), SubjectLabel: pending.Email,
			Before: jsonencoding.MustMarshalJson(map[string]any{"status": pending.Status}), After: jsonencoding.MustMarshalJson(map[string]any{"status": approved.Status}),
			Reason: strings.TrimSpace(command.Reason), StepUpVerified: command.Actor.SteppedUp,
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	if err := handler.Container.Delivery.DeliverStaffInvitation(ctx, approved.Email, approved.DisplayName, token); err != nil {
		return types.StaffView{}, err
	}
	return services.BuildSingleStaffView(ctx, handler.Container, approved)
}
