package admin

import (
	"context"

	"zudomart/modules/admin/src"
	"zudomart/modules/admin/src/configs"
	"zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

func NewAdminModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewAdminModule(ctx, dependencies)
}

func StartAdminModuleWithSettings(ctx context.Context, settings configs.AdminSettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*src.Module, error) {
	return src.StartAdminModuleWithSettings(ctx, settings, publisher, dependencies)
}
