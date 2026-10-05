package listautomationexecutions

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/automationexecution"
	"zudomart/modules/moderation/src/modules/automationRules/dtos"
)

const pageSize = 100

var outcomes = map[automationexecution.Status]string{
	automationexecution.StatusSucceeded: "ACTIONS_RUN", automationexecution.StatusFailed: "FAILED", automationexecution.StatusRunning: "ACTIONS_RUN",
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, ruleId string) (dtos.Items[dtos.Execution], error) {
	query := handler.Container.Client.AutomationExecution.Query()
	if ruleId != "" {
		query = query.Where(automationexecution.RuleID(ruleId))
	}
	rows, err := query.Order(ent.Desc(automationexecution.FieldStartedAt), ent.Desc(automationexecution.FieldID)).Limit(pageSize).All(ctx)
	if err != nil {
		return dtos.Items[dtos.Execution]{}, err
	}
	items := make([]dtos.Execution, 0, len(rows))
	for _, row := range rows {
		outcome, known := outcomes[row.Status]
		if !known {
			outcome = "CONDITIONS_NOT_MET"
		}
		actionsRun := row.ActionsRun
		if actionsRun == nil {
			actionsRun = []string{}
		}
		items = append(items, dtos.Execution{
			Id: row.ID.String(), RuleId: row.RuleID, RuleVersion: row.RuleVersion, RuleName: row.RuleName, Event: row.Event, SubjectLabel: row.SubjectLabel, OccurredAt: row.StartedAt.UTC().Format(time.RFC3339),
			Outcome: outcome, Status: string(row.Status), ActionsRun: actionsRun, ErrorMessage: row.Error, Steps: row.Steps,
		})
	}
	return dtos.Items[dtos.Execution]{Items: items}, nil
}
