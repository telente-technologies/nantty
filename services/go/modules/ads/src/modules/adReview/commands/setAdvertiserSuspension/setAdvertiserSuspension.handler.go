package setadvertisersuspension

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdvertiserDetail, error) {
	deployed := handler.Container
	account, err := deployed.Client.AdAccount.Get(ctx, command.AccountId)
	if ent.IsNotFound(err) {
		return dtos.AdvertiserDetail{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.AdvertiserDetail{}, err
	}
	targetStatus := adaccount.StatusActive
	if command.Suspend {
		targetStatus = adaccount.StatusDisabled
	}
	if account.Status == targetStatus {
		return dtos.AdvertiserDetail{}, adserrors.AdvertiserStateUnchanged
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdAccount.UpdateOneID(account.ID).SetStatus(targetStatus).SetDisabledReason("")
		if command.Suspend {
			update.SetDisabledReason(strings.TrimSpace(command.Reason))
			if err := tx.AdCampaign.Update().Where(adcampaign.AccountID(account.ID), adcampaign.StatusEQ(adcampaign.StatusActive)).SetStatus(adcampaign.StatusPaused).Exec(ctx); err != nil {
				return err
			}
		}
		return update.Exec(ctx)
	})
	if err != nil {
		return dtos.AdvertiserDetail{}, err
	}
	if account, err = deployed.Client.AdAccount.Get(ctx, account.ID); err != nil {
		return dtos.AdvertiserDetail{}, err
	}
	return services.LoadAdvertiserDetail(ctx, deployed, account)
}
