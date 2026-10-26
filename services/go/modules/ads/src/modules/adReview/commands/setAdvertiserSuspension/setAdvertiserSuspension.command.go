package setadvertisersuspension

import (
	"strings"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type Command struct {
	AccountId uuid.UUID
	Suspend   bool
	Reason    string
}

func Validate(reason string) error {
	if len(strings.TrimSpace(reason)) < 5 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "Give a reason of at least 5 characters."}})
	}
	return nil
}
