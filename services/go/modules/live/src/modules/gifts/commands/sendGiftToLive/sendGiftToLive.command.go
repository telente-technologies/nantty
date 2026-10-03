package sendgifttolive

import (
	"zudomart/modules/live/src/types"
)

type Command struct {
	Actor types.Actor
	Input types.SendGiftInput
}
