package updateroomsettings

import (
	"context"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.RoomSettingsView, error) {
	return services.NewLiveService(handler.Container).UpdateRoomSettings(ctx, command.Actor, command.LiveId, command.Input)
}
