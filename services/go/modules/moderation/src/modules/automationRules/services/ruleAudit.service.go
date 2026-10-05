package services

import (
	"context"
	"encoding/json"
	"fmt"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/platform/staffauth"
)

type RuleAuditEntry struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
	RuleId    string
	Version   int
	Verb      string
	Reason    string
	Before    *RuleContent
	After     *RuleContent
}

func RecordRuleAudit(ctx context.Context, c *container.Container, entry RuleAuditEntry) error {
	before, _ := json.Marshal(entry.Before)
	after, _ := json.Marshal(entry.After)
	label := entry.RuleId
	if entry.After != nil {
		label = entry.After.Name
	} else if entry.Before != nil {
		label = entry.Before.Name
	}
	return c.Audit.Record(ctx, integrations.AuditRecord{
		ActorId: entry.Staff.Id, ActorName: entry.Staff.Name, ActorRole: entry.Staff.Role, Action: "config.automation_rule." + entry.Verb, SubjectType: "automation_rule", SubjectId: entry.RuleId,
		SubjectLabel: fmt.Sprintf("%s v%d", label, entry.Version), Before: before, After: after, Reason: entry.Reason, IpAddress: entry.IpAddress, RequestId: entry.RequestId, StepUpVerified: entry.Staff.SteppedUp,
	})
}
