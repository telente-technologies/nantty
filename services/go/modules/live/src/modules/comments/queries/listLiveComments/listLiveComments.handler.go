package listlivecomments

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]types.LiveCommentView, string, error) {
	return services.NewLiveService(handler.Container).ListLiveComments(ctx, query.Actor, query.LiveId, query.Cursor, query.Limit, query.OldestFirst)
}
