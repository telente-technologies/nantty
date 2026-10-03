package users

import (
	"context"

	"zudomart/modules/users/src"
	"zudomart/modules/users/src/configs"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewUsersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewUsersModule(ctx, dependencies)
}

func StartUsersModuleWithSettings(ctx context.Context, settings configs.UsersSettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	return src.StartUsersModuleWithSettings(ctx, settings, publisher, dependencies)
}
