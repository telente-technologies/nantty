package listcheckmarksuggestions

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/checkmarks/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) ([]services.Suggestion, error) {
	acting, summary, err := services.LoadActingProfile(ctx, handler.Container, accountId)
	if err != nil {
		return nil, err
	}
	return services.BuildSuggestionsForProfile(ctx, handler.Container, acting, summary)
}
