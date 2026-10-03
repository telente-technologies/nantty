package escrows

import (
	"zudomart/modules/escrow/src/container"
	disputeservices "zudomart/modules/escrow/src/modules/disputes/services"
	"zudomart/modules/escrow/src/modules/escrows/services"
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
