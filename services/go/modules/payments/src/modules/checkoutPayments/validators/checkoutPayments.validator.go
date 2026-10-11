package validators

import (
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/checkoutPayments/dtos"
)

func ValidateInitializeOrderPaymentRequest(request dtos.InitializeOrderPaymentRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("orderId", request.OrderId, 0, 80)
	collector.RequireLength("checkoutId", request.CheckoutId, 0, 80)
	if (request.OrderId == "") == (request.CheckoutId == "") {
		collector.Add("checkoutId", "send exactly one of checkoutId or orderId")
	}
	if request.Provider != "" {
		collector.RequireOneOf("provider", request.Provider, "flutterwave")
	}
	collector.RequireLength("returnTo", request.ReturnTo, 0, 300)
	return collector.Result()
}
