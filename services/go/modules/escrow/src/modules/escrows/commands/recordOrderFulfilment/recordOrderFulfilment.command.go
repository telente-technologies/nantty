package recordorderfulfilment

import "nantty/modules/escrow/src/modules/escrows/services"

type Command struct {
	Fulfilment services.OrderFulfilment
}
