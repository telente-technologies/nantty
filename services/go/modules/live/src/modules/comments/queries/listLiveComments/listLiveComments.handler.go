package listlivecomments

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]types.LiveCommentView, string, error) {
	return services.NewLiveService(handler.Container).ListLiveComments(ctx, query.Actor, query.LiveId, query.Cursor, query.Limit)
}
