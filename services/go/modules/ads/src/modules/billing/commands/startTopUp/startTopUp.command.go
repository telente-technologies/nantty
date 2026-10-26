package starttopup

import (
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/platform/httpserver"
)

type Command struct {
	AccountId      uuid.UUID
	UserId         uuid.UUID
	IdempotencyKey string
	Request        dtos.StartTopUpRequest
}

func (command Command) Validate() error {
	var issues []httpserver.ValidationIssue
	if provider := command.Request.Provider; provider != "" && provider != "flutterwave" {
		issues = append(issues, httpserver.ValidationIssue{Path: "provider", Message: "The payment provider is chosen by Zudomart; leave it out."})
	}
	path := command.Request.ReturnPath
	if path != "" && (!strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.ContainsAny(path, "\\\r\n") || len(path) > 200) {
		issues = append(issues, httpserver.ValidationIssue{Path: "returnPath", Message: "must be a path in the Ads Manager"})
	}
	if command.Request.Amount.AmountMinor <= 0 || len(command.Request.Amount.Currency) != 3 {
		issues = append(issues, httpserver.ValidationIssue{Path: "amount", Message: "Enter an amount above zero."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}
