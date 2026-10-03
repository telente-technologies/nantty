package creators

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewCreatorsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "creators"}, nil
}
