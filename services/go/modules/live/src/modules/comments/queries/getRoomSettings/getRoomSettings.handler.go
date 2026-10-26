package getroomsettings

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.RoomSettingsView, error) {
	return services.NewLiveService(handler.Container).GetRoomSettings(ctx, query.Actor, query.LiveId)
}
