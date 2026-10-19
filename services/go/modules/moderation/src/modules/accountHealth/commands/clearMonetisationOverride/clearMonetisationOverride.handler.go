package clearmonetisationoverride

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	"zudomart/platform/httpserver"
)

const OverrideClearedReason = "monetisation_override_cleared"

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.AccountHealthView, error) {
	reason, err := services.ValidateMonetisationOverrideRequest(command.Staff, command.Reason)
	if err != nil {
		return services.AccountHealthView{}, err
	}
	account, err := uuid.Parse(command.AccountId)
	if err != nil {
		return services.AccountHealthView{}, httpserver.ErrNotFound
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := services.LockMonetisationStateInTransaction(ctx, tx, account, now)
		if err != nil {
			return err
		}
		before := services.OverrideFromState(state)
		if before == nil {
			return nil
		}
		if err := services.ClearMonetisationOverrideInTransaction(ctx, tx, account, now); err != nil {
			return err
		}
		if err := services.RecordMonetisationOverrideAudit(ctx, handler.Container, services.MonetisationOverrideAudit{
			Staff: command.Staff, IpAddress: command.IpAddress, RequestId: command.RequestId, AccountId: account, Action: "account_health.monetisation_override_cleared", Before: before, Reason: reason,
		}); err != nil {
			return err
		}
		_, err = services.EnqueueHealthChangedInTransaction(ctx, tx, account, now, OverrideClearedReason)
		return err
	})
	if err != nil {
		return services.AccountHealthView{}, err
	}
	return services.BuildAccountHealth(ctx, handler.Container.Client, account, now, true)
}
