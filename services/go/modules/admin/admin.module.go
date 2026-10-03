package admin

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewAdminModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "admin"}, nil
}
