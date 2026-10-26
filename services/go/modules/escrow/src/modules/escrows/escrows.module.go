package escrows

import (
	"nantty/modules/escrow/src/container"
	disputeservices "nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows/services"
)

type Application struct {
	Container *container.Container
	Escrows   services.EscrowService
	Disputes  disputeservices.DisputeService
}

func NewEscrowApplication(container *container.Container) *Application {
	escrows := services.EscrowService{Container: container}
	return &Application{Container: container, Escrows: escrows, Disputes: disputeservices.DisputeService{Escrows: escrows}}
}
