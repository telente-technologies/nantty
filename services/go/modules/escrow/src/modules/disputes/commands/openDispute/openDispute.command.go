package opendispute

import "nantty/modules/escrow/src/modules/disputes/services"

type Command struct {
	Input          services.OpenDisputeInput
	IdempotencyKey string
}
