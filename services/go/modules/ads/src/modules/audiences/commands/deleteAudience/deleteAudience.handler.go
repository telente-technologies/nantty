package deleteaudience

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaudiencemember"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionAudiencesManage); err != nil {
		return err
	}
	row, err := services.LoadAudienceInAccount(ctx, deployed.Client, command.AccountId, command.AudienceId)
	if err != nil {
		return err
	}
	lookalikes, err := deployed.Client.AdCustomAudience.Query().Where(adcustomaudience.LookalikeSourceID(row.ID)).Exist(ctx)
	if err != nil {
		return err
	}
	if lookalikes || services.CountAdSetsUsing(ctx, deployed, command.AccountId, row.ID) > 0 {
		return adserrors.AudienceInUse
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.AdAudienceMember.Delete().Where(adaudiencemember.AudienceID(row.ID)).Exec(ctx); err != nil {
			return err
		}
		return tx.AdCustomAudience.DeleteOne(row).Exec(ctx)
	})
}
