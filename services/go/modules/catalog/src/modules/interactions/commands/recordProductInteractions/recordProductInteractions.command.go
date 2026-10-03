package recordproductinteractions

import (
	"zudomart/modules/catalog/src/modules/interactions/dtos"
	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor   services.InteractionActor
	Consent services.ConsentChoices
	Events  []dtos.InteractionRecord
}
