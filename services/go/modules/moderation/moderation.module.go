package moderation

import (
	"context"

	"zudomart/modules/moderation/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewModerationModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewModerationModule(ctx, dependencies)
}
