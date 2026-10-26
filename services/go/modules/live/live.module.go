package live

import (
	"context"

	"nantty/modules/live/src"
	"nantty/modules/live/src/configs"
	"nantty/platform/servicemodule"
)

type (
	Module        = src.Module
	Collaborators = src.Collaborators
)

func NewLiveModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewLiveModule(ctx, dependencies)
}

func StartLiveModuleWithSettings(ctx context.Context, settings configs.LiveSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	return src.StartLiveModuleWithSettings(ctx, settings, collaborators, dependencies)
}
