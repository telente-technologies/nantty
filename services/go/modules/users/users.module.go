package users

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewUsersModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "users"}, nil
}
