package restoreautomationrule

import (
	"context"
	"encoding/json"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/modules/automationRules/dtos"
	"nantty/modules/moderation/src/modules/automationRules/repositories"
	"nantty/modules/moderation/src/modules/automationRules/services"
	"nantty/modules/moderation/src/modules/automationRules/validators"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.VersionedRecord, error) {
	expected, err := validators.ValidateExpectedVersion(command.ExpectedVersion)
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	reason, err := validators.ValidateReason(command.Reason)
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	var record dtos.VersionedRecord
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := repositories.LockCurrent(ctx, tx, command.RuleId)
		if err != nil {
			return err
		}
		if current == nil || (command.Archive && current.IsArchived) {
			return repositories.ErrRuleNotFound
		}
		var before *services.RuleContent
		if !current.IsArchived {
			decoded := repositories.RecordFromRule(current).Content
			before = &decoded
		}
		write := repositories.VersionWrite{RuleId: command.RuleId, ExpectedVersion: expected, Reason: reason, Staff: command.Staff, Now: handler.Container.Now(), Archived: command.Archive}
		verb := "archived"
		if command.Archive {
			write.Content = *before
		} else {
			if write.Content, err = handler.restorableContent(ctx, tx, command); err != nil {
				return err
			}
			verb = "restored"
		}
		if record, err = repositories.AppendVersion(ctx, tx, current, write); err != nil {
			return err
		}
		after := &write.Content
		if command.Archive {
			after = nil
		}
		return services.RecordRuleAudit(ctx, handler.Container, services.RuleAuditEntry{
			Staff: command.Staff, IpAddress: command.IpAddress, RequestId: command.RequestId, RuleId: command.RuleId, Version: record.Version, Verb: verb, Reason: reason, Before: before, After: after,
		})
	})
	return record, err
}

func (handler Handler) restorableContent(ctx context.Context, tx *ent.Tx, command Command) (services.RuleContent, error) {
	target, err := repositories.FindVersion(ctx, tx, command.RuleId, command.Version)
	if err != nil {
		return services.RuleContent{}, err
	}
	if target.IsArchived {
		return services.RuleContent{}, repositories.ErrVersionNotFound
	}
	var previous services.RuleContent
	if err := json.Unmarshal(target.Content, &previous); err != nil {
		return services.RuleContent{}, err
	}
	return validators.ValidateRuleContent(target.Content, &previous)
}
