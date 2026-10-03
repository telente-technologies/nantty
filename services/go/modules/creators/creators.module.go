package creators

import (
	"context"

	"zudomart/modules/creators/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewCreatorsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewCreatorsModule(ctx, dependencies)
}
