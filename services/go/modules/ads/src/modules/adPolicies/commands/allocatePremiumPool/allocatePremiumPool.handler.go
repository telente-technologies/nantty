package allocatepremiumpool

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/adPolicies/dtos"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PremiumPoolResult, error) {
	weights := make([]adsservices.ConsumptionWeight, 0, len(command.Request.Consumption))
	for _, row := range command.Request.Consumption {
		weights = append(weights, adsservices.ConsumptionWeight{CreatorUserId: row.CreatorUserId, WatchSeconds: row.WatchSeconds})
	}
	creatorIds := make([]string, 0, len(weights))
	for _, weight := range weights {
		creatorIds = append(creatorIds, weight.CreatorUserId)
	}
	paused, err := (adsservices.CreatorMonetisationHolds{Client: handler.Container.Client, Now: handler.Container.Now}).PausedCreators(ctx, creatorIds)
	if err != nil {
		return dtos.PremiumPoolResult{}, err
	}
	weights = adsservices.ExcludePausedCreatorsFromConsumption(weights, paused)
	allocations, err := adsservices.AllocatePremiumPoolByConsumption(command.Request.PoolMinor, command.Request.Currency, weights)
	if err != nil {
		return dtos.PremiumPoolResult{}, err
	}
	result := dtos.PremiumPoolResult{Allocations: make([]dtos.PremiumAllocation, 0, len(allocations))}
	entries := make([]events.PremiumAllocationEntry, 0, len(allocations))
	for _, allocation := range allocations {
		result.Allocations = append(result.Allocations, dtos.PremiumAllocation{CreatorUserId: allocation.CreatorUserId, AmountMinor: allocation.AmountMinor})
		entries = append(entries, events.PremiumAllocationEntry{CreatorUserId: allocation.CreatorUserId, AmountMinor: allocation.AmountMinor})
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdPremiumPoolAllocated, command.Request.Month, handler.Container.Now(), events.AdPremiumPoolAllocatedEventData{
			Month: command.Request.Month, Currency: command.Request.Currency, PoolMinor: command.Request.PoolMinor, Allocations: entries,
		})
	})
	return result, err
}
