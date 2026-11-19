package services_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	automationservices "nantty/modules/moderation/src/modules/automationRules/services"
)

type (
	Action            = automationservices.Action
	Condition         = automationservices.Condition
	Engine            = automationservices.Engine
	Event             = automationservices.Event
	ExecutionRecord   = automationservices.ExecutionRecord
	ReservationLimits = automationservices.ReservationLimits
	Rule              = automationservices.Rule
	RuleContent       = automationservices.RuleContent
	Threshold         = automationservices.Threshold
)

const (
	ActionQueueForReview = automationservices.ActionQueueForReview
	ActionHideTarget     = automationservices.ActionHideTarget
	ActionFlagUser       = automationservices.ActionFlagUser
	EventReportCreated   = automationservices.EventReportCreated
)

type memoryStore struct {
	rules       []Rule
	occurrences []Event
	seen        map[string]bool
	times       []time.Time
	executions  []ExecutionRecord
}

func (store *memoryStore) EnabledRules(_ context.Context, event string) ([]Rule, error) {
	matching := []Rule{}
	for _, rule := range store.rules {
		if rule.Content.Event == event && rule.Content.IsEnabled {
			matching = append(matching, rule)
		}
	}
	return matching, nil
}

func (store *memoryStore) RecordOccurrence(_ context.Context, event Event, at time.Time) (bool, error) {
	if event.SourceEventId != "" && store.seen[event.SourceEventId] {
		return false, nil
	}
	store.seen[event.SourceEventId] = true
	store.occurrences, store.times = append(store.occurrences, event), append(store.times, at)
	return true, nil
}

func (store *memoryStore) CountOccurrencesSince(_ context.Context, event, subjectKey string, since time.Time) (int, error) {
	count := 0
	for index, occurrence := range store.occurrences {
		if occurrence.Name == event && occurrence.SubjectKey == subjectKey && !store.times[index].Before(since) {
			count++
		}
	}
	return count, nil
}

func (store *memoryStore) Record(_ context.Context, record ExecutionRecord) error {
	store.executions = append(store.executions, record)
	return nil
}

func (store *memoryStore) Reserve(_ context.Context, record ExecutionRecord, limits ReservationLimits) (string, string, error) {
	recent, gate := 0, ""
	for _, previous := range store.executions {
		active := previous.Rule.Id == record.Rule.Id && (previous.Status == "running" || previous.Status == "succeeded")
		if active && previous.Event.SubjectKey == record.Event.SubjectKey && (limits.OncePerSubject || (limits.CooldownSince != nil && previous.StartedAt.After(*limits.CooldownSince))) {
			gate = "suppressed"
		}
		if active && previous.StartedAt.After(limits.HourSince) {
			recent++
		}
	}
	if gate == "" && recent >= limits.MaxPerHour {
		gate = "rate_limited"
	}
	record.Status = "running"
	if gate != "" {
		record.Status = gate
		record.Steps = append(record.Steps, automationservices.GateStep(gate, record.Rule.Content))
	}
	store.executions = append(store.executions, record)
	if gate != "" {
		return "", gate, nil
	}
	return fmt.Sprint(len(store.executions) - 1), "", nil
}

func (store *memoryStore) Finish(_ context.Context, executionId string, record ExecutionRecord) error {
	var index int
	fmt.Sscan(executionId, &index)
	store.executions[index] = record
	return nil
}

type recordingActions struct {
	failOn string
	keys   []string
}

func (actions *recordingActions) Run(_ context.Context, _ Rule, action Action, _ Event, key string) (string, error) {
	if action.Type == actions.failOn {
		return "", errors.New("target service timed out")
	}
	actions.keys = append(actions.keys, key)
	return "done", nil
}

func newEngine(rules ...Rule) (*Engine, *memoryStore, *recordingActions, *time.Time) {
	store, actions, now := &memoryStore{rules: rules, seen: map[string]bool{}}, &recordingActions{}, time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	engine := &Engine{Store: store, Actions: actions, Now: func() time.Time { return now }, Logger: slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))}
	return engine, store, actions, &now
}

func rule(id string, mutate func(*RuleContent)) Rule {
	content := RuleContent{Name: id, IsEnabled: true, Event: EventReportCreated, ConditionMatch: "ALL", Conditions: []Condition{{Field: "reason", Operator: "EQUALS", Value: "scam"}}, Actions: []Action{{Type: ActionQueueForReview}}, MaxExecutionsPerHour: 60}
	if mutate != nil {
		mutate(&content)
	}
	return Rule{Id: id, Version: 1, Content: content}
}

func report(subject, reason, sourceId string) Event {
	return Event{Name: EventReportCreated, SubjectKey: subject, SourceEventId: sourceId, Data: map[string]any{"reason": reason}}
}

func statuses(store *memoryStore) []string {
	out := []string{}
	for _, execution := range store.executions {
		out = append(out, execution.Status)
	}
	return out
}

func TestEngineGatesRunsInOrder(t *testing.T) {
	cooldown := 600
	cases := []struct {
		name    string
		rule    Rule
		events  []Event
		advance time.Duration
		want    string
	}{
		{"conditions not met are skipped", rule("r", nil), []Event{report("post:1", "spam", "e1")}, 0, "[skipped]"},
		{"null cooldown runs once per subject", rule("r", nil), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e2"), report("post:2", "scam", "e3")}, 0, "[succeeded suppressed succeeded]"},
		{"cooldown suppresses inside the window", rule("r", func(c *RuleContent) { c.CooldownSeconds = &cooldown }), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e2")}, 0, "[succeeded suppressed]"},
		{"cooldown allows after the window", rule("r", func(c *RuleContent) { c.CooldownSeconds = &cooldown }), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e2")}, 11 * time.Minute, "[succeeded succeeded]"},
		{"hourly cap rate limits", rule("r", func(c *RuleContent) { zero := 0; c.CooldownSeconds = &zero; c.MaxExecutionsPerHour = 2 }), []Event{report("a", "scam", "e1"), report("b", "scam", "e2"), report("c", "scam", "e3")}, 0, "[succeeded succeeded rate_limited]"},
		{"threshold waits for enough occurrences", rule("r", func(c *RuleContent) { c.Threshold = &Threshold{Count: 3, WithinSeconds: 3600} }), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e2"), report("post:1", "scam", "e3")}, 0, "[skipped skipped succeeded]"},
		{"threshold window forgets old occurrences", rule("r", func(c *RuleContent) { c.Threshold = &Threshold{Count: 2, WithinSeconds: 60} }), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e2")}, 2 * time.Minute, "[skipped skipped]"},
		{"duplicate deliveries are ignored", rule("r", nil), []Event{report("post:1", "scam", "e1"), report("post:1", "scam", "e1")}, 0, "[succeeded]"},
		{"disabled rules never run", rule("r", func(c *RuleContent) { c.IsEnabled = false }), []Event{report("post:1", "scam", "e1")}, 0, "[]"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			engine, store, _, now := newEngine(testCase.rule)
			for _, event := range testCase.events {
				if err := engine.HandleEvent(context.Background(), event); err != nil {
					t.Fatal(err)
				}
				*now = now.Add(testCase.advance)
			}
			if got := fmt.Sprint(statuses(store)); got != testCase.want {
				t.Fatalf("got %s, want %s", got, testCase.want)
			}
		})
	}
}

func TestEngineStopsAtTheFirstFailingActionAndLogsSteps(t *testing.T) {
	engine, store, actions, _ := newEngine(rule("r", func(c *RuleContent) {
		c.Actions = []Action{{Type: ActionQueueForReview}, {Type: ActionHideTarget}, {Type: ActionFlagUser}}
	}))
	actions.failOn = ActionHideTarget
	if err := engine.HandleEvent(context.Background(), report("post:1", "scam", "e1")); err != nil {
		t.Fatal(err)
	}
	execution := store.executions[0]
	if execution.Status != "failed" || execution.Error == nil || fmt.Sprint(execution.ActionsRun) != "[queue_for_review]" || len(execution.Steps) != 3 || execution.Steps[2].Outcome != "error" {
		t.Fatalf("unexpected execution %+v", execution)
	}
	if len(actions.keys) != 1 || actions.keys[0] != "automation:0:0" {
		t.Fatalf("actions get stable idempotency keys: %v", actions.keys)
	}
}
