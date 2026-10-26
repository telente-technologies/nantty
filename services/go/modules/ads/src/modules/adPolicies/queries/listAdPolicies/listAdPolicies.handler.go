package listadpolicies

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adfrequencypolicy"
	"nantty/modules/ads/src/modules/adPolicies/dtos"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, _ Query) (dtos.AdPolicies, error) {
	frequency, err := handler.Container.Client.AdFrequencyPolicy.Query().Order(adfrequencypolicy.ByFormat()).All(ctx)
	if err != nil {
		return dtos.AdPolicies{}, err
	}
	result := dtos.AdPolicies{Frequency: []dtos.FrequencyPolicy{}}
	for _, row := range frequency {
		result.Frequency = append(result.Frequency, dtos.FrequencyPolicy{Format: row.Format, SessionCap: row.SessionCap, HourCap: row.HourCap, DayCap: row.DayCap, AdvertiserDayCap: row.AdvertiserDayCap, MinGapSlots: row.MinGapSlots, CooldownSecondsAfterSkip: row.CooldownSecondsAfterSkip, Active: row.Active})
	}
	return result, nil
}
