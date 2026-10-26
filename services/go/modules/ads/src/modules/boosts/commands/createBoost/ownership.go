package createboost

import (
	"context"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/modules/boosts/services"
)

func (handler Handler) requireOwnedDestination(ctx context.Context, command Command) error {
	request := command.Request
	owned, err := handler.Container.Ownership.Owns(ctx, interfaces.OwnershipQuery{Kind: request.DestinationType, TargetId: request.TargetId, OwnerUserId: command.UserId.String()})
	if err != nil {
		return err
	}
	if !owned {
		return adserrors.DestinationNotOwned
	}
	return handler.requireAvailableDestination(ctx, request.DestinationType, request.TargetId)
}

func (handler Handler) requireAvailableDestination(ctx context.Context, kind, targetId string) error {
	if kind == services.DestinationPost || kind == services.DestinationProduct || handler.Container.Promoted == nil {
		return nil
	}
	found, err := handler.Container.Promoted.LookupDestinations(ctx, kind, []string{targetId})
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "promoted destination status unavailable; boost allowed without the check", "error", err)
		return nil
	}
	if destination, exists := found[targetId]; !exists || !destination.Available {
		return adserrors.DestinationUnavailable
	}
	return nil
}
