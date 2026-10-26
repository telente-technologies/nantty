package services

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/integrations"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

func ValidateMonetisationOverrideRequest(staff staffauth.Staff, reason string) (string, error) {
	trimmed := strings.TrimSpace(reason)
	if length := len([]rune(trimmed)); length < 5 || length > 1000 {
		return "", httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	if !staff.SteppedUp {
		return "", httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	return trimmed, nil
}

type MonetisationOverrideAudit struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	AccountId uuid.UUID
	Action    string
	Before    *MonetisationOverride
	After     *MonetisationOverride
	Reason    string
}

func RecordMonetisationOverrideAudit(ctx context.Context, c *container.Container, entry MonetisationOverrideAudit) error {
	before, _ := json.Marshal(map[string]any{"monetisationOverride": DescribeMonetisationOverride(entry.Before)})
	after, _ := json.Marshal(map[string]any{"monetisationOverride": DescribeMonetisationOverride(entry.After)})
	return c.Audit.Record(ctx, integrations.AuditRecord{
		ActorId: entry.Staff.Id, ActorName: entry.Staff.Name, ActorRole: entry.Staff.Role, Action: entry.Action, SubjectType: "user", SubjectId: entry.AccountId.String(), SubjectLabel: "monetisation",
		Before: before, After: after, Reason: entry.Reason, IpAddress: entry.IpAddress, RequestId: entry.RequestId, StepUpVerified: entry.Staff.SteppedUp,
	})
}
