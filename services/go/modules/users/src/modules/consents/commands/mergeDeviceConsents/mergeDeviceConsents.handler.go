package mergedeviceconsents

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/modules/consents/services"
	privacyservices "nantty/modules/users/src/modules/privacySettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (int, error) {
	merged := 0
	err := privacyservices.RunAccountDecisionTransaction(ctx, handler.Container, func(tx *ent.Tx) error {
		merged = 0
		deviceRows, err := services.LoadLatestRowsByType(ctx, tx.Client(), models.Subject{DeviceId: command.DeviceId})
		if err != nil {
			return err
		}
		accountRows, err := services.LoadLatestRowsByType(ctx, tx.Client(), services.AccountSubject(command.AccountId))
		if err != nil {
			return err
		}
		metadata := command.Metadata
		metadata.Source = "device_merge"
		for policyVersion, decisions := range groupByPolicyVersion(services.ChooseDeviceDecisionsThatWinOverAccount(deviceRows, accountRows)) {
			changes, err := privacyservices.ApplyAccountDecisionsInTransaction(ctx, tx, command.AccountId, decisions, policyVersion, metadata, handler.Container.Now())
			if err != nil {
				return err
			}
			merged += len(changes)
		}
		return nil
	})
	return merged, err
}

func groupByPolicyVersion(winners []services.DeviceDecision) map[string][]models.Decision {
	grouped := map[string][]models.Decision{}
	for _, winner := range winners {
		grouped[winner.Policy] = append(grouped[winner.Policy], winner.Decision)
	}
	return grouped
}
