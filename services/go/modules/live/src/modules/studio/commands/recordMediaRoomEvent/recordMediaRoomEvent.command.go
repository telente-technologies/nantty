package recordmediaroomevent

import (
	"zudomart/modules/live/src/services"
)

type Command struct {
	Event services.MediaRoomEvent
}
