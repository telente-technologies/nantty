package moderation

import (
	"context"

	"nantty/modules/moderation/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewModerationModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewModerationModule(ctx, dependencies)
}
