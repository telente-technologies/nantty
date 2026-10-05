package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

type paystackRefund struct {
	Id           json.Number `json:"id"`
	Status       string      `json:"status"`
	MerchantNote string      `json:"merchant_note"`
}

func (provider *PaystackProvider) FindRefundByReference(ctx context.Context, lookup interfaces.RefundLookup) (interfaces.RefundResult, bool, error) {
	query := url.Values{"perPage": {"100"}}
	if transaction := firstNonEmptyString(lookup.ProviderChargeId, lookup.ChargeReference); transaction != "" {
		query.Set("transaction", transaction)
	}
	if !lookup.SubmittedAfter.IsZero() {
		query.Set("from", lookup.SubmittedAfter.Add(-time.Hour).UTC().Format(time.RFC3339))
	}
	var page paystackPage[paystackRefund]
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/refund", query: query}, &page); err != nil {
		return interfaces.RefundResult{}, false, err
	}
	for _, refund := range page.Items {
		if interfaces.NoteCarriesRefundReference(refund.MerchantNote, lookup.RefundReference) {
			return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertPaystackRefundStatus(refund.Status), NeedsCustomerDetail: refund.Status == "needs-attention"}, true, nil
		}
	}
	return interfaces.RefundResult{}, false, nil
}
