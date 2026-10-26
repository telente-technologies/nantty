package upsertfrequencypolicy

import (
	"context"

	"nantty/modules/ads/src/container"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	policy := command.Policy
	err := handler.Container.Client.AdFrequencyPolicy.Create().SetFormat(policy.Format).SetSessionCap(policy.SessionCap).SetHourCap(policy.HourCap).SetDayCap(policy.DayCap).
		SetAdvertiserDayCap(policy.AdvertiserDayCap).SetMinGapSlots(policy.MinGapSlots).SetCooldownSecondsAfterSkip(policy.CooldownSecondsAfterSkip).SetActive(policy.Active).
		OnConflictColumns("format").UpdateNewValues().Exec(ctx)
	if err == nil {
		handler.Container.Policies.Invalidate()
	}
	return err
}
