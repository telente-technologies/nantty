package saveautomationrule

import (
	"context"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/modules/automationRules/dtos"
	"nantty/modules/moderation/src/modules/automationRules/repositories"
	"nantty/modules/moderation/src/modules/automationRules/services"
	"nantty/modules/moderation/src/modules/automationRules/validators"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.VersionedRecord, bool, error) {
	if !validators.RuleIdPattern.MatchString(command.RuleId) {
		return dtos.VersionedRecord{}, false, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "id", Message: "use rule_ followed by 3 to 58 lowercase letters, digits or underscores"}})
	}
	expected, err := validators.ValidateExpectedVersion(command.ExpectedVersion)
	if err != nil {
		return dtos.VersionedRecord{}, false, err
	}
	reason, err := validators.ValidateReason(command.Reason)
	if err != nil {
		return dtos.VersionedRecord{}, false, err
	}
	var record dtos.VersionedRecord
	var creating bool
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := repositories.LockCurrent(ctx, tx, command.RuleId)
		if err != nil {
			return err
		}
		creating = current == nil || current.IsArchived
		var previous *services.RuleContent
		if !creating {
			decoded := repositories.RecordFromRule(current).Content
			previous = &decoded
		}
		content, err := validators.ValidateRuleContent(command.Content, previous)
		if err != nil {
			return err
		}
		record, err = repositories.AppendVersion(ctx, tx, current, repositories.VersionWrite{RuleId: command.RuleId, ExpectedVersion: expected, Reason: reason, Content: content, Staff: command.Staff, Now: handler.Container.Now()})
		if err != nil {
			return err
		}
		verb := "updated"
		if creating {
			verb = "created"
		}
		return services.RecordRuleAudit(ctx, handler.Container, services.RuleAuditEntry{
			Staff: command.Staff, IpAddress: command.IpAddress, RequestId: command.RequestId, RuleId: command.RuleId, Version: record.Version, Verb: verb, Reason: reason, Before: previous, After: &content,
		})
	})
	return record, creating, err
}
