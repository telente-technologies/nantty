package creators

import (
	"context"

	"nantty/modules/creators/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewCreatorsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewCreatorsModule(ctx, dependencies)
}
