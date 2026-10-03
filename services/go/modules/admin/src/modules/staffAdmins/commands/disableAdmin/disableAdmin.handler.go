package disableadmin

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StaffView, error) {
	return services.ChangeStaffAccess(ctx, handler.Container, command.Actor, command.TargetId, services.AccessActionDisable, command.Reason)
}
