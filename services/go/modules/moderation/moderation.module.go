package moderation

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewModerationModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "moderation"}, nil
}
