package checkoutcart

import "zudomart/modules/orders/src/services"

type Command struct {
	Request services.CheckoutRequest
}
