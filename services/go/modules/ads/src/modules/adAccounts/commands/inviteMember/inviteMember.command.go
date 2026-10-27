package invitemember

import (
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/adAccounts/dtos"
	"nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/platform/httpserver"
)

type Command struct {
	AccountId   uuid.UUID
	ActorUserId uuid.UUID
	Request     dtos.InviteMemberRequest
}

func Validate(request dtos.InviteMemberRequest) error {
	var issues []httpserver.ValidationIssue
	username, email := strings.TrimSpace(request.Username), strings.TrimSpace(request.Email)
	switch {
	case username == "" && email == "":
		issues = append(issues, httpserver.ValidationIssue{Path: "username", Message: "Enter the username or email of an existing Nantty user."})
	case username != "" && email != "":
		issues = append(issues, httpserver.ValidationIssue{Path: "email", Message: "Enter either a username or an email, not both."})
	case email != "" && !looksLikeEmail(email):
		issues = append(issues, httpserver.ValidationIssue{Path: "email", Message: "Enter a valid email address."})
	}
	if !services.IsAccountRole(request.Role) {
		issues = append(issues, httpserver.ValidationIssue{Path: "role", Message: "Choose admin, advertiser, analyst or billing."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func looksLikeEmail(value string) bool {
	at := strings.LastIndex(value, "@")
	return at > 0 && at < len(value)-3 && strings.Contains(value[at:], ".") && !strings.ContainsAny(value, " \t") && len(value) <= 254
}

func InviteeIdentifier(request dtos.InviteMemberRequest) (value string, byEmail bool) {
	if email := strings.TrimSpace(request.Email); email != "" {
		return email, true
	}
	username := strings.TrimSpace(request.Username)
	if looksLikeEmail(username) {
		return username, true
	}
	return strings.TrimPrefix(username, "@"), false
}
