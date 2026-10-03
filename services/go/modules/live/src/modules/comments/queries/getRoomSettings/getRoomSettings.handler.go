package getroomsettings

import (
	"context"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.RoomSettingsView, error) {
	return services.NewLiveService(handler.Container).GetRoomSettings(ctx, query.Actor, query.LiveId)
}
