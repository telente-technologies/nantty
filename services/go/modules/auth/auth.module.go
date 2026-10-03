package auth

import (
	"context"

	"zudomart/modules/auth/src"
	"zudomart/modules/auth/src/configs"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewAuthModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewAuthModule(ctx, dependencies)
}

func StartAuthModuleWithSettings(ctx context.Context, settings configs.AuthSettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	return src.StartAuthModuleWithSettings(ctx, settings, publisher, dependencies)
}
