package changeadminipallowlist

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/repositories"
	"nantty/modules/admin/src/types"
	ipallowlist "nantty/modules/admin/src/utils/ipAllowList"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
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
	entries, valid := ipallowlist.NormalizeEntries(command.IpAllowList)
	if !valid || len(entries) > ipallowlist.MaximumEntries {
		return types.StaffView{}, adminerrors.ValidationFailedFor("ipAllowList", "must list at most 50 IP addresses or CIDR ranges")
	}
	var updated *ent.StaffAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
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
		if err := acting.AssertCanActOn(existing, false); err != nil {
			return err
		}
		if updated, err = existing.Update().SetIPAllowList(entries).Save(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "admin.ip_allow_list_changed", SubjectType: "staff", SubjectId: target.String(), SubjectLabel: existing.Email,
			Before: jsonencoding.MustMarshalJson(map[string]any{"ipAllowList": existing.IPAllowList}), After: jsonencoding.MustMarshalJson(map[string]any{"ipAllowList": entries}),
			Reason: strings.TrimSpace(command.Reason), StepUpVerified: command.Actor.SteppedUp,
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	return services.BuildSingleStaffView(ctx, handler.Container, updated)
}
