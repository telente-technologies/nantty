package recordorderfulfilment

import "zudomart/modules/escrow/src/modules/escrows/services"

type Command struct {
	Fulfilment services.OrderFulfilment
}
