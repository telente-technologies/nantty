package services

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

type Store interface {
	EnabledRules(ctx context.Context, event string) ([]Rule, error)
	RecordOccurrence(ctx context.Context, event Event, at time.Time) (bool, error)
	CountOccurrencesSince(ctx context.Context, event, subjectKey string, since time.Time) (int, error)
	Record(ctx context.Context, record ExecutionRecord) error
	Reserve(ctx context.Context, record ExecutionRecord, limits ReservationLimits) (string, string, error)
	Finish(ctx context.Context, executionId string, record ExecutionRecord) error
}

type ActionRunner interface {
	Run(ctx context.Context, rule Rule, action Action, event Event, idempotencyKey string) (string, error)
}

type Engine struct {
	Store   Store
	Actions ActionRunner
	Now     func() time.Time
	Logger  *slog.Logger
}

func (engine Engine) HandleEvent(ctx context.Context, event Event) error {
	rules, err := engine.Store.EnabledRules(ctx, event.Name)
	if err != nil || len(rules) == 0 {
		return err
	}
	recorded, err := engine.Store.RecordOccurrence(ctx, event, engine.Now())
	if err != nil || !recorded {
		return err
	}
	for _, rule := range rules {
		if err := engine.evaluate(ctx, rule, event); err != nil {
			engine.Logger.ErrorContext(ctx, "automation rule could not be evaluated", slog.String("ruleId", rule.Id), slog.Any("error", err))
		}
	}
	return nil
}

func (engine Engine) evaluate(ctx context.Context, rule Rule, event Event) error {
	content := rule.Content
	record := ExecutionRecord{Rule: rule, Event: event, StartedAt: engine.Now(), ActionsRun: []string{}}
	steps, met := ConditionsMet(content, event.Data)
	record.Steps = steps
	if !met {
		return engine.finishWithoutActions(ctx, record, "skipped")
	}
	if threshold := content.Threshold; threshold != nil {
		since := record.StartedAt.Add(-time.Duration(threshold.WithinSeconds) * time.Second)
		seen, err := engine.Store.CountOccurrencesSince(ctx, event.Name, event.SubjectKey, since)
		if err != nil {
			return err
		}
		reached := seen >= threshold.Count
		record.Steps = append(record.Steps, Step{Kind: "threshold", Name: fmt.Sprintf("%d in %ds", threshold.Count, threshold.WithinSeconds), Outcome: outcomeFor(reached), Detail: fmt.Sprintf("%d seen", seen)})
		if !reached {
			return engine.finishWithoutActions(ctx, record, "skipped")
		}
	}
	executionId, gate, err := engine.Store.Reserve(ctx, record, engine.limitsFor(content, record.StartedAt))
	if err != nil || gate != "" {
		return err
	}
	return engine.runActions(ctx, executionId, record)
}

func (engine Engine) limitsFor(content RuleContent, startedAt time.Time) ReservationLimits {
	limits := ReservationLimits{HourSince: startedAt.Add(-time.Hour), MaxPerHour: content.MaxExecutionsPerHour, OncePerSubject: content.CooldownSeconds == nil}
	if limits.MaxPerHour <= 0 {
		limits.MaxPerHour = DefaultMaxExecutionsPerHour
	}
	if content.CooldownSeconds != nil {
		since := startedAt.Add(-time.Duration(*content.CooldownSeconds) * time.Second)
		limits.CooldownSince = &since
	}
	return limits
}

func (engine Engine) runActions(ctx context.Context, executionId string, record ExecutionRecord) error {
	record.Status = "succeeded"
	for index, action := range record.Rule.Content.Actions {
		detail, err := engine.Actions.Run(ctx, record.Rule, action, record.Event, fmt.Sprintf("automation:%s:%d", executionId, index))
		if err != nil {
			message := err.Error()
			record.Steps = append(record.Steps, Step{Kind: "action", Name: action.Type, Outcome: "error", Detail: message})
			record.Status, record.Error = "failed", &message
			break
		}
		record.Steps = append(record.Steps, Step{Kind: "action", Name: action.Type, Outcome: "passed", Detail: detail})
		record.ActionsRun = append(record.ActionsRun, action.Type)
	}
	finished := engine.Now()
	record.FinishedAt = &finished
	return engine.Store.Finish(ctx, executionId, record)
}

func (engine Engine) finishWithoutActions(ctx context.Context, record ExecutionRecord, status string) error {
	finished := engine.Now()
	record.Status, record.FinishedAt = status, &finished
	return engine.Store.Record(ctx, record)
}

func outcomeFor(passed bool) string {
	if passed {
		return "passed"
	}
	return "failed"
}

func GateStep(gate string, content RuleContent) Step {
	if gate == "rate_limited" {
		return Step{Kind: "rate_limit", Name: fmt.Sprintf("%d per hour", content.MaxExecutionsPerHour), Outcome: "failed"}
	}
	if content.CooldownSeconds == nil {
		return Step{Kind: "cooldown", Name: "once per subject", Outcome: "failed"}
	}
	return Step{Kind: "cooldown", Name: fmt.Sprintf("%ds cooldown", *content.CooldownSeconds), Outcome: "failed"}
}
