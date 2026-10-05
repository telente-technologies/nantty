package createconversionevent

import (
	"context"
	"strings"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adconversionevent"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/tools/dtos"
	"zudomart/modules/ads/src/modules/tools/services"
	"zudomart/modules/ads/src/modules/tools/validators"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ConversionEvent, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return dtos.ConversionEvent{}, err
	}
	if err := validators.ValidateConversionEventInput(command.Input); err != nil {
		return dtos.ConversionEvent{}, err
	}
	if account.StoreID == "" {
		return dtos.ConversionEvent{}, adserrors.StoreRequired
	}
	if command.Input.StoreId != "" && command.Input.StoreId != account.StoreID {
		return dtos.ConversionEvent{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "storeId", Message: "Choose the store linked to this ad account."}})
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var created *ent.AdConversionEvent
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		created, err = tx.AdConversionEvent.Create().SetAccountID(account.ID).SetName(strings.TrimSpace(command.Input.Name)).SetEventType(adconversionevent.EventType(command.Input.EventType)).
			SetStoreID(account.StoreID).SetStoreName(services.StoreName(ctx, deployed, account)).SetTracksValue(command.Input.TracksValue).Save(ctx)
		if err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "conversion_event", created.ID.String(), actor, "Created conversion event "+created.Name, command.Input)
	})
	if err != nil {
		return dtos.ConversionEvent{}, err
	}
	return services.PresentConversionEvent(created, services.ReadConversionActivity(ctx, deployed.Client, created, deployed.Now())), nil
}
