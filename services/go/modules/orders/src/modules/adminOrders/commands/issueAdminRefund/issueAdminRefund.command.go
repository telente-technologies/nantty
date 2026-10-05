package issueadminrefund

import (
	"net/http"

	"zudomart/modules/orders/src/modules/adminOrders/services"
)

type Command struct {
	Refund  services.AdminRefund
	Request *http.Request
}
