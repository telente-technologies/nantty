package deleteaudience

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaudiencemember"
	"zudomart/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/audiences/services"
	adsservices "zudomart/modules/ads/src/services"
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
