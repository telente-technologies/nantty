package creditaccountfunds

import (
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/platform/httpserver"
)

type Command struct {
	AccountId uuid.UUID
	Request   dtos.CreditFundsRequest
}

func (command Command) Validate() error {
	request := command.Request
	if request.Reference == "" || len(request.Reference) > 128 || request.AmountMinor <= 0 || len(request.Currency) != 3 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "body", Message: "reference, amountMinor and currency are required"}})
	}
	if request.Type != "top_up" && request.Type != "credit_grant" && request.Type != "refund" {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "type", Message: "Use top_up, credit_grant or refund."}})
	}
	if request.ExpiresAt != nil {
		if _, err := time.Parse(time.RFC3339, *request.ExpiresAt); err != nil {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "expiresAt", Message: "must be RFC 3339"}})
		}
	}
	return nil
}
