package issueadminrefund

import (
	"net/http"

	"nantty/modules/orders/src/modules/adminOrders/services"
)

type Command struct {
	Refund  services.AdminRefund
	Request *http.Request
}
