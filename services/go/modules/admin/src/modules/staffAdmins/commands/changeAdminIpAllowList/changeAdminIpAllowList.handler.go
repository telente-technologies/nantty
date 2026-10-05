package changeadminipallowlist

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/repositories"
	"zudomart/modules/admin/src/types"
	ipallowlist "zudomart/modules/admin/src/utils/ipAllowList"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
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
