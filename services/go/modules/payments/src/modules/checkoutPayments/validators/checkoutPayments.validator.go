package validators

import (
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/modules/checkoutPayments/dtos"
)

func ValidateInitializeOrderPaymentRequest(request dtos.InitializeOrderPaymentRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("orderId", request.OrderId, 1, 80)
	if request.Provider != "" {
		collector.RequireOneOf("provider", request.Provider, "paystack")
	}
	collector.RequireLength("returnTo", request.ReturnTo, 0, 300)
	return collector.Result()
}
