package getstaffsettings

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAdmins/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (Result, error) {
	return Result{RequireSecondSuperadminApproval: services.SecondSuperadminApprovalRequired(ctx, handler.Container.Client)}, nil
}
