package recordproductinteractions

import (
	"nantty/modules/catalog/src/modules/interactions/dtos"
	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor   services.InteractionActor
	Consent services.ConsentChoices
	Events  []dtos.InteractionRecord
}
