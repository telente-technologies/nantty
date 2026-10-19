package setmonetisationoverride

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	"zudomart/platform/httpserver"
)

const OverrideSetReason = "monetisation_override_set"

var modes = map[string]string{"ALLOW": services.OverrideModeAllow, "PAUSE": services.OverrideModePause}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.AccountHealthView, error) {
	mode := modes[command.Mode]
	if mode == "" {
		return services.AccountHealthView{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "mode", Message: "must be ALLOW or PAUSE"}})
	}
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
		withoutOverride, err := services.LoadStandingWithOverride(ctx, tx.Client(), account, now, nil)
		if err != nil {
			return err
		}
		if mode == services.OverrideModeAllow && withoutOverride.Standing.CanMonetise {
			return httpserver.NewApiError(http.StatusConflict, "MONETISATION_NOT_PAUSED", "Monetisation is not paused for this account, so there is nothing to allow.")
		}
		override := services.MonetisationOverride{
			Mode: mode, ActiveStrikeCountAtOverride: withoutOverride.Input.ActiveStrikes, Reason: reason, ActorId: command.Staff.Id, ActorName: command.Staff.Name, SetAt: now,
		}
		if err := services.SetMonetisationOverrideInTransaction(ctx, tx, account, override); err != nil {
			return err
		}
		if err := services.RecordMonetisationOverrideAudit(ctx, handler.Container, services.MonetisationOverrideAudit{
			Staff: command.Staff, IpAddress: command.IpAddress, RequestId: command.RequestId, AccountId: account, Action: "account_health.monetisation_override_" + mode, Before: services.OverrideFromState(state), After: &override, Reason: reason,
		}); err != nil {
			return err
		}
		_, err = services.EnqueueHealthChangedInTransaction(ctx, tx, account, now, OverrideSetReason)
		return err
	})
	if err != nil {
		return services.AccountHealthView{}, err
	}
	return services.BuildAccountHealth(ctx, handler.Container.Client, account, now, true)
}
