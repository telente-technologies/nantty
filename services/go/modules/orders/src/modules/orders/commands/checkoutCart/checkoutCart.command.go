package checkoutcart

import "nantty/modules/orders/src/services"

type Command struct {
	Request services.CheckoutRequest
}
