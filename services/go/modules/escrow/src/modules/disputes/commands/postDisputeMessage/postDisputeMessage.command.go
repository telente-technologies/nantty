package postdisputemessage

import "nantty/modules/escrow/src/modules/disputes/services"

type Command struct {
	Input          services.DisputeMessageInput
	IdempotencyKey string
}
