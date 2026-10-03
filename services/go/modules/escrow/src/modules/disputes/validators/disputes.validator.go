package validators

import (
	"net/url"

	"zudomart/modules/escrow/src/modules/disputes/dtos"
	ledgerutils "zudomart/modules/ledger/src/utils"
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

func ValidateResolveDisputeRequest(request dtos.ResolveDisputeRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireOneOf("outcome", request.Outcome, "release", "refund", "partial")
	collector.RequireLength("note", request.Note, 3, 2000)
	if request.Outcome == "partial" && request.RefundAmountMinor <= 0 {
		collector.Add("refundAmountMinor", "is required for a partial outcome")
	}
	if request.Outcome != "partial" && request.RefundAmountMinor != 0 {
		collector.Add("refundAmountMinor", "is only allowed for a partial outcome")
	}
	return collector.Result()
}
