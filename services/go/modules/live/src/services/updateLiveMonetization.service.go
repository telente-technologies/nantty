package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
)

func (service *LiveService) UpdateLiveMonetization(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.LiveMonetizationInput) (types.LiveSessionView, error) {
	record, version, err := service.buildLiveAdSettingsRecord(input)
	if err != nil {
		return types.LiveSessionView{}, err
	}
	var updated *ent.LiveSession
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		update := session.Update()
		if record != nil {
			update.SetLiveAdSettings(record)
			if version != nil {
				update.SetAcceptedLiveAdTermsVersion(*version).SetAcceptedLiveAdTermsAt(service.Now())
			}
		}
		if input.SponsorshipLine != "" {
			update.SetSponsorshipLine(input.SponsorshipLine)
		}
		updated, err = update.Save(ctx)
		return err
	})
	if err != nil {
		return types.LiveSessionView{}, err
	}
	return service.presentLiveSession(ctx, updated)
}
