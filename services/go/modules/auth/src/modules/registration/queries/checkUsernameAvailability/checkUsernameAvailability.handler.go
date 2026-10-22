package checkusernameavailability

import (
	"context"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/services"
)

type Handler struct {
	*container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (services.UsernameAvailability, error) {
	return services.CheckUsernameAvailability(ctx, handler.Container, query.Username, query.Name, query.Authenticated)
}
