package suspendadminaccess

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StaffView, error) {
	return services.ChangeStaffAccess(ctx, handler.Container, command.Actor, command.TargetId, services.AccessActionSuspend, command.Reason)
}
