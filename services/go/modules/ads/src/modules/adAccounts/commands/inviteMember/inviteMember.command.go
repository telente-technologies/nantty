package invitemember

import (
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	"zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/platform/httpserver"
)

type Command struct {
	AccountId   uuid.UUID
	ActorUserId uuid.UUID
	Request     dtos.InviteMemberRequest
}

func Validate(request dtos.InviteMemberRequest) error {
	var issues []httpserver.ValidationIssue
	if strings.TrimSpace(request.Username) == "" {
		issues = append(issues, httpserver.ValidationIssue{Path: "username", Message: "Enter the username of an existing Zudomart user."})
	}
	if !services.IsAccountRole(request.Role) {
		issues = append(issues, httpserver.ValidationIssue{Path: "role", Message: "Choose admin, advertiser, analyst or billing."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}
