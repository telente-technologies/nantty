package appealadrejection

import (
	"strings"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type Command struct {
	AccountId uuid.UUID
	AdId      uuid.UUID
	UserId    uuid.UUID
	Message   string
}

func Validate(message string) error {
	if length := len(strings.TrimSpace(message)); length < 20 || length > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "message", Message: "Explain your appeal in 20-1000 characters."}})
	}
	return nil
}
