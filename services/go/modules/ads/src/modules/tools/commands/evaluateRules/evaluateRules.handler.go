package evaluaterules

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adautomatedrule"
	"nantty/modules/ads/src/modules/tools/services"
	adsservices "nantty/modules/ads/src/services"
)

const rulesPerSweep = 100

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context) (int, error) {
	deployed := handler.Container
	now := deployed.Now()
	due, err := deployed.Client.AdAutomatedRule.Query().Where(adautomatedrule.StatusEQ(adautomatedrule.StatusActive), adautomatedrule.NextRunAtLTE(now)).
		Order(ent.Asc(adautomatedrule.FieldNextRunAt)).Limit(rulesPerSweep).All(ctx)
	if err != nil {
		return 0, err
	}
	triggered := 0
	for _, rule := range due {
		fired, err := handler.evaluate(ctx, rule, now)
		if err != nil {
			return triggered, err
		}
		if fired {
			triggered++
		}
	}
	return triggered, nil
}

func (handler Handler) evaluate(ctx context.Context, rule *ent.AdAutomatedRule, now time.Time) (bool, error) {
	deployed := handler.Container
	account, err := deployed.Client.AdAccount.Get(ctx, rule.AccountID)
	if err != nil {
		return false, err
	}
	matched := []string{}
	for _, raw := range rule.TargetIds {
		id, err := uuid.Parse(raw)
		if err != nil {
			continue
		}
		hit, err := handler.targetMatches(ctx, rule, account.Timezone, id, now)
		if err != nil {
			return false, err
		}
		if hit {
			matched = append(matched, raw)
		}
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdAutomatedRule.UpdateOneID(rule.ID).SetLastRunAt(now).SetNextRunAt(now.Add(time.Duration(rule.CheckEveryMinutes) * time.Minute))
		if len(matched) == 0 {
			return update.Exec(ctx)
		}
		if err := update.SetLastTriggeredAt(now).AddTriggerCount(1).Exec(ctx); err != nil {
			return err
		}
		return handler.act(ctx, tx, rule, matched, now)
	})
	return len(matched) > 0, err
}

func (handler Handler) targetMatches(ctx context.Context, rule *ent.AdAutomatedRule, timezone string, id uuid.UUID, now time.Time) (bool, error) {
	delivering, err := services.TargetIsDelivering(ctx, handler.Container.Client, string(rule.Level), id)
	if err != nil || !delivering {
		return false, err
	}
	for _, condition := range rule.Conditions {
		totals, err := services.ReadDeliveryTotals(ctx, handler.Container.Database, string(rule.Level), id, services.WindowStartDay(condition.Window, now, timezone))
		if err != nil {
			return false, err
		}
		if !services.ConditionHolds(condition, totals) {
			return false, nil
		}
	}
	return len(rule.Conditions) > 0, nil
}

func (handler Handler) act(ctx context.Context, tx *ent.Tx, rule *ent.AdAutomatedRule, matched []string, now time.Time) error {
	percent := 0
	if rule.ActionPercent != nil {
		percent = *rule.ActionPercent
	}
	for _, raw := range matched {
		if err := services.ApplyRuleActionInTransaction(ctx, tx, string(rule.Level), string(rule.ActionType), percent, uuid.MustParse(raw)); err != nil {
			return err
		}
	}
	summary := fmt.Sprintf("Rule %q ran %s on %d item(s)", rule.Name, rule.ActionType, len(matched))
	if err := adsservices.RecordActivityInTransaction(ctx, tx, rule.AccountID, "rule", rule.ID.String(), adsservices.ActivityActor{Name: "Automated rule"}, summary, map[string]any{"targetIds": matched, "action": rule.ActionType}); err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdRuleTriggered, rule.ID.String(), now, events.AdRuleTriggeredEventData{
		RuleId: rule.ID.String(), AccountId: rule.AccountID.String(), RuleName: rule.Name, Action: string(rule.ActionType), TargetIds: matched, TriggeredAt: now.UTC().Format(time.RFC3339),
	})
}
