package saverule

import (
	"context"
	"strings"
	"time"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adautomatedrule"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/tools/dtos"
	"nantty/modules/ads/src/modules/tools/services"
	"nantty/modules/ads/src/modules/tools/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AutomatedRule, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return dtos.AutomatedRule{}, err
	}
	var existing *ent.AdAutomatedRule
	input := dtos.AutomatedRuleInput{}
	if command.Create != nil {
		input = *command.Create
	} else {
		if existing, err = services.FindRule(ctx, deployed.Client, account.ID, command.RuleId); err != nil || existing == nil {
			return dtos.AutomatedRule{}, orNotFound(err)
		}
		current := services.PresentRule(existing)
		input = merge(dtos.AutomatedRuleInput{Name: current.Name, Level: current.Level, TargetIds: current.TargetIds, Conditions: current.Conditions, Action: current.Action, CheckEveryMinutes: current.CheckEveryMinutes}, *command.Patch)
		if status := command.Patch.Status; status != nil && *status != "active" && *status != "paused" {
			return dtos.AutomatedRule{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "Choose active or paused."}})
		}
	}
	if err := validators.ValidateRuleInput(input); err != nil {
		return dtos.AutomatedRule{}, err
	}
	if err := services.RequireTargetsInAccount(ctx, deployed, account.ID, input.Level, input.TargetIds); err != nil {
		return dtos.AutomatedRule{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var saved *ent.AdAutomatedRule
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if saved, err = handler.write(ctx, tx, command, existing, input); err != nil {
			return err
		}
		summary := "Updated rule " + saved.Name
		if existing == nil {
			summary = "Created rule " + saved.Name
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "rule", saved.ID.String(), actor, summary, input)
	})
	if err != nil {
		return dtos.AutomatedRule{}, err
	}
	return services.PresentRule(saved), nil
}

func (handler Handler) write(ctx context.Context, tx *ent.Tx, command Command, existing *ent.AdAutomatedRule, input dtos.AutomatedRuleInput) (*ent.AdAutomatedRule, error) {
	now := handler.Container.Now()
	nextRun := now.Add(time.Duration(input.CheckEveryMinutes) * time.Minute)
	if existing == nil {
		return tx.AdAutomatedRule.Create().SetAccountID(command.AccountId).SetName(strings.TrimSpace(input.Name)).SetLevel(adautomatedrule.Level(input.Level)).SetTargetIds(input.TargetIds).
			SetConditions(input.Conditions).SetActionType(adautomatedrule.ActionType(input.Action.Type)).SetNillableActionPercent(input.Action.Percent).
			SetCheckEveryMinutes(input.CheckEveryMinutes).SetNextRunAt(nextRun).SetCreatedByUserID(command.UserId).Save(ctx)
	}
	update := tx.AdAutomatedRule.UpdateOneID(existing.ID).SetName(strings.TrimSpace(input.Name)).SetLevel(adautomatedrule.Level(input.Level)).SetTargetIds(input.TargetIds).
		SetConditions(input.Conditions).SetActionType(adautomatedrule.ActionType(input.Action.Type)).ClearActionPercent().SetNillableActionPercent(input.Action.Percent).
		SetCheckEveryMinutes(input.CheckEveryMinutes)
	if command.Patch.Status != nil {
		update.SetStatus(adautomatedrule.Status(*command.Patch.Status))
		if *command.Patch.Status == "active" && existing.Status != adautomatedrule.StatusActive {
			update.SetNextRunAt(nextRun)
		}
	}
	return update.Save(ctx)
}

func orNotFound(err error) error {
	if err != nil {
		return err
	}
	return adserrors.RuleNotFound
}
