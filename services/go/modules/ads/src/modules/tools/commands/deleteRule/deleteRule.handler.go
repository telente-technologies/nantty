package deleterule

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/tools/services"
	adsservices "nantty/modules/ads/src/services"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	RuleId    string
}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return err
	}
	rule, err := services.FindRule(ctx, deployed.Client, account.ID, command.RuleId)
	if err != nil {
		return err
	}
	if rule == nil {
		return adserrors.RuleNotFound
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAutomatedRule.DeleteOneID(rule.ID).Exec(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "rule", rule.ID.String(), actor, "Deleted rule "+rule.Name, nil)
	})
}
