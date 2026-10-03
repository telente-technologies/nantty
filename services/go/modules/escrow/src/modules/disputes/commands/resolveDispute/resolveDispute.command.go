package resolvedispute

import "zudomart/modules/escrow/src/modules/disputes/services"

type Command struct {
	Input          services.ResolveDisputeInput
	IdempotencyKey string
}
