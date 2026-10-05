package updateconversionevent

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adconversionevent"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/tools/dtos"
	"zudomart/modules/ads/src/modules/tools/services"
	"zudomart/modules/ads/src/modules/tools/validators"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ConversionEvent, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return dtos.ConversionEvent{}, err
	}
	if err := validators.ValidateConversionEventPatch(command.Patch); err != nil {
		return dtos.ConversionEvent{}, err
	}
	id, err := uuid.Parse(command.EventId)
	if err != nil {
		return dtos.ConversionEvent{}, adserrors.ConversionEventNotFound
	}
	event, err := deployed.Client.AdConversionEvent.Query().Where(adconversionevent.ID(id), adconversionevent.AccountID(account.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.ConversionEvent{}, adserrors.ConversionEventNotFound
	}
	if err != nil {
		return dtos.ConversionEvent{}, err
	}
	if event.IsBuiltIn && command.Patch.Status != nil && *command.Patch.Status == "paused" {
		return dtos.ConversionEvent{}, adserrors.BuiltInEvent
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdConversionEvent.UpdateOneID(event.ID)
		if command.Patch.Name != nil {
			update.SetName(strings.TrimSpace(*command.Patch.Name))
		}
		if command.Patch.Status != nil {
			update.SetStatus(adconversionevent.Status(*command.Patch.Status))
		}
		if event, err = update.Save(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "conversion_event", event.ID.String(), actor, "Updated conversion event "+event.Name, command.Patch)
	})
	if err != nil {
		return dtos.ConversionEvent{}, err
	}
	return services.PresentConversionEvent(event, services.ReadConversionActivity(ctx, deployed.Client, event, deployed.Now())), nil
}
