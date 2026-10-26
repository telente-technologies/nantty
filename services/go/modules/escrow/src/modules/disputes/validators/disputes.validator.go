package validators

import (
	"net/url"
	"strings"

	"nantty/modules/escrow/src/modules/disputes/dtos"
	ledgerutils "nantty/modules/ledger/src/utils"
)

func requireHttpsUrls(collector *ledgerutils.IssueCollector, path string, urls []string) {
	if len(urls) > 10 {
		collector.Add(path, "has more than 10 items")
	}
	for _, raw := range urls {
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" || len(raw) > 500 {
			collector.Add(path, "must contain https URLs")
			return
		}
	}
}

func ValidateOpenDisputeRequest(request dtos.OpenDisputeRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireOneOf("reason", request.Reason, "not_received", "not_as_described", "damaged", "wrong_item", "other")
	collector.RequireLength("description", request.Description, 0, 2000)
	requireHttpsUrls(collector, "evidenceUrls", request.EvidenceUrls)
	return collector.Result()
}

func ValidateDisputeMessageRequest(request dtos.DisputeMessageRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("text", request.Text, 1, 2000)
	requireHttpsUrls(collector, "attachmentUrls", request.AttachmentUrls)
	return collector.Result()
}

var resolveOutcomeAliases = map[string]string{"REFUND_FULL": "refund", "REFUND_PARTIAL": "partial", "RELEASE_TO_SELLER": "release"}

type ResolveDisputeDecision struct {
	Outcome        string
	Note           string
	RefundMinor    int64
	RefundCurrency string
}

func NormalizeResolveDisputeRequest(request dtos.ResolveDisputeRequestDto) (ResolveDisputeDecision, error) {
	collector := &ledgerutils.IssueCollector{}
	decision := ResolveDisputeDecision{Outcome: request.Outcome, Note: request.Note, RefundMinor: request.RefundAmountMinor}
	if alias, found := resolveOutcomeAliases[request.Outcome]; found {
		decision.Outcome = alias
	}
	if request.Reason != "" {
		if request.Note != "" {
			collector.Add("reason", "send either note or reason, not both")
		}
		decision.Note = request.Reason
	}
	if request.RefundAmount != nil {
		if request.RefundAmountMinor != 0 {
			collector.Add("refundAmount", "send either refundAmount or refundAmountMinor, not both")
		}
		decision.RefundMinor, decision.RefundCurrency = request.RefundAmount.AmountMinor, request.RefundAmount.Currency
		collector.RequireLength("refundAmount.currency", request.RefundAmount.Currency, 3, 3)
	}
	decision.Note = strings.TrimSpace(decision.Note)
	collector.RequireOneOf("outcome", decision.Outcome, "release", "refund", "partial")
	collector.RequireLength("note", decision.Note, 3, 2000)
	if decision.Outcome == "partial" && decision.RefundMinor <= 0 {
		collector.Add("refundAmountMinor", "is required for a partial outcome")
	}
	if decision.Outcome != "partial" && decision.RefundMinor != 0 {
		collector.Add("refundAmountMinor", "is only allowed for a partial outcome")
	}
	return decision, collector.Result()
}
