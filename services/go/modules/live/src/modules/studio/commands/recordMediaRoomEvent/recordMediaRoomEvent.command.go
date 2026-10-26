package recordmediaroomevent

import (
	"nantty/modules/live/src/services"
)

type Command struct {
	Event services.MediaRoomEvent
}
