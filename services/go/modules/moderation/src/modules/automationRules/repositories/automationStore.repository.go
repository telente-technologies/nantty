package repositories

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/automationeventoccurrence"
	"zudomart/modules/moderation/src/generated/ent/automationexecution"
	"zudomart/modules/moderation/src/generated/ent/automationrule"
	"zudomart/modules/moderation/src/modules/automationRules/services"
)

type EntStore struct {
	Container *container.Container
}

func DecodeRule(row *ent.AutomationRule) (services.Rule, error) {
	var content services.RuleContent
	if err := json.Unmarshal(row.Content, &content); err != nil {
		return services.Rule{}, err
	}
	return services.Rule{Id: row.ID, Version: row.Version, Content: content}, nil
}

func (store EntStore) EnabledRules(ctx context.Context, event string) ([]services.Rule, error) {
	rows, err := store.Container.Client.AutomationRule.Query().Where(automationrule.Event(event), automationrule.IsEnabled(true), automationrule.IsArchived(false)).Order(ent.Asc(automationrule.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	rules := make([]services.Rule, 0, len(rows))
	for _, row := range rows {
		rule, err := DecodeRule(row)
		if err != nil {
			store.Container.Logger.WarnContext(ctx, "automation rule content is unreadable", "ruleId", row.ID)
			continue
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (store EntStore) RecordOccurrence(ctx context.Context, event services.Event, at time.Time) (bool, error) {
	create := store.Container.Client.AutomationEventOccurrence.Create().SetEvent(event.Name).SetSubjectKey(truncate(event.SubjectKey, 200)).SetOccurredAt(at).SetCreatedAt(at)
	if event.SourceEventId != "" {
		create.SetSourceEventID(truncate(event.SourceEventId, 128))
	}
	err := create.Exec(ctx)
	if ent.IsConstraintError(err) {
		return false, nil
	}
	return err == nil, err
}

func (store EntStore) CountOccurrencesSince(ctx context.Context, event, subjectKey string, since time.Time) (int, error) {
	return store.Container.Client.AutomationEventOccurrence.Query().Where(automationeventoccurrence.Event(event), automationeventoccurrence.SubjectKey(truncate(subjectKey, 200)), automationeventoccurrence.OccurredAtGTE(since)).Count(ctx)
}

func (store EntStore) Record(ctx context.Context, record services.ExecutionRecord) error {
	_, err := store.create(ctx, store.Container.Client, record)
	return err
}

func (store EntStore) Reserve(ctx context.Context, record services.ExecutionRecord, limits services.ReservationLimits) (string, string, error) {
	var executionId, gate string
	err := store.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.AutomationRule.Query().Where(automationrule.ID(record.Rule.Id)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		active := automationexecution.StatusIn(automationexecution.StatusRunning, automationexecution.StatusSucceeded)
		cooldown := tx.AutomationExecution.Query().Where(automationexecution.RuleID(record.Rule.Id), automationexecution.SubjectKey(truncate(record.Event.SubjectKey, 200)), active)
		if limits.CooldownSince != nil {
			cooldown = cooldown.Where(automationexecution.StartedAtGT(*limits.CooldownSince))
		}
		suppressed, err := false, error(nil)
		if limits.OncePerSubject || limits.CooldownSince != nil {
			if suppressed, err = cooldown.Exist(ctx); err != nil {
				return err
			}
		}
		if suppressed {
			gate = "suppressed"
		} else {
			recent, err := tx.AutomationExecution.Query().Where(automationexecution.RuleID(record.Rule.Id), active, automationexecution.StartedAtGT(limits.HourSince)).Count(ctx)
			if err != nil {
				return err
			}
			if recent >= limits.MaxPerHour {
				gate = "rate_limited"
			}
		}
		record.Status = "running"
		if gate != "" {
			finished := record.StartedAt
			record.Status, record.FinishedAt = gate, &finished
			record.Steps = append(record.Steps, services.GateStep(gate, record.Rule.Content))
		}
		created, err := store.create(ctx, tx.Client(), record)
		if err == nil {
			executionId = created.ID.String()
		}
		return err
	})
	if gate != "" {
		executionId = ""
	}
	return executionId, gate, err
}

func (store EntStore) Finish(ctx context.Context, executionId string, record services.ExecutionRecord) error {
	identifier, err := uuid.Parse(executionId)
	if err != nil {
		return err
	}
	steps, _ := json.Marshal(record.Steps)
	update := store.Container.Client.AutomationExecution.UpdateOneID(identifier).SetStatus(automationexecution.Status(record.Status)).SetSteps(steps).SetActionsRun(record.ActionsRun)
	if record.FinishedAt != nil {
		update.SetFinishedAt(*record.FinishedAt)
	}
	if record.Error != nil {
		update.SetError(truncate(*record.Error, 1000))
	}
	return update.Exec(ctx)
}

func (store EntStore) create(ctx context.Context, client *ent.Client, record services.ExecutionRecord) (*ent.AutomationExecution, error) {
	steps, _ := json.Marshal(record.Steps)
	input, _ := json.Marshal(record.Event.Data)
	actionsRun := record.ActionsRun
	if actionsRun == nil {
		actionsRun = []string{}
	}
	create := client.AutomationExecution.Create().SetRuleID(record.Rule.Id).SetRuleVersion(record.Rule.Version).SetRuleName(truncate(record.Rule.Content.Name, 120)).SetEvent(record.Event.Name).
		SetSubjectKey(truncate(record.Event.SubjectKey, 200)).SetSubjectLabel(truncate(record.Event.SubjectLabel, 200)).SetStatus(automationexecution.Status(record.Status)).SetSteps(steps).SetInput(input).
		SetActionsRun(actionsRun).SetStartedAt(record.StartedAt).SetCreatedAt(record.StartedAt).SetNillableFinishedAt(record.FinishedAt)
	if record.Error != nil {
		create.SetError(truncate(*record.Error, 1000))
	}
	return create.Save(ctx)
}

func (store EntStore) DeleteOccurrencesBefore(ctx context.Context, cutoff time.Time) (int, error) {
	return store.Container.Client.AutomationEventOccurrence.Delete().Where(automationeventoccurrence.OccurredAtLT(cutoff)).Exec(ctx)
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
