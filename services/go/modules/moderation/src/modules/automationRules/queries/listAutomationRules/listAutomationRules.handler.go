package listautomationrules

import (
	"context"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/automationrule"
	"nantty/modules/moderation/src/generated/ent/automationruleversion"
	"nantty/modules/moderation/src/modules/automationRules/dtos"
	"nantty/modules/moderation/src/modules/automationRules/repositories"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (dtos.Items[dtos.VersionedRecord], error) {
	rows, err := handler.Container.Client.AutomationRule.Query().Where(automationrule.IsArchived(false)).Order(ent.Asc(automationrule.FieldID)).All(ctx)
	if err != nil {
		return dtos.Items[dtos.VersionedRecord]{}, err
	}
	items := make([]dtos.VersionedRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, repositories.RecordFromRule(row))
	}
	return dtos.Items[dtos.VersionedRecord]{Items: items}, nil
}

func (handler Handler) Current(ctx context.Context, ruleId string) (dtos.VersionedRecord, error) {
	row, err := handler.Container.Client.AutomationRule.Get(ctx, ruleId)
	if ent.IsNotFound(err) || (err == nil && row.IsArchived) {
		return dtos.VersionedRecord{}, repositories.ErrRuleNotFound
	}
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	return repositories.RecordFromRule(row), nil
}

func (handler Handler) Versions(ctx context.Context, ruleId string) (dtos.Items[dtos.VersionedRecord], error) {
	rows, err := handler.Container.Client.AutomationRuleVersion.Query().Where(automationruleversion.RuleID(ruleId)).Order(ent.Desc(automationruleversion.FieldVersion)).All(ctx)
	if err != nil {
		return dtos.Items[dtos.VersionedRecord]{}, err
	}
	if len(rows) == 0 {
		return dtos.Items[dtos.VersionedRecord]{}, repositories.ErrRuleNotFound
	}
	items := make([]dtos.VersionedRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, repositories.RecordFromVersion(row))
	}
	return dtos.Items[dtos.VersionedRecord]{Items: items}, nil
}
