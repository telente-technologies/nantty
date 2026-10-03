package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
)

func (application *LiveApplication) UpdateLiveMonetization(ctx context.Context, actor Actor, liveId uuid.UUID, input LiveMonetizationInput) (LiveSessionView, error) {
	record, version, err := application.buildLiveAdSettingsRecord(input)
	if err != nil {
		return LiveSessionView{}, err
	}
	var updated *ent.LiveSession
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return errNotLiveHost
		}
		update := session.Update()
		if record != nil {
			update.SetLiveAdSettings(record)
			if version != nil {
				update.SetAcceptedLiveAdTermsVersion(*version).SetAcceptedLiveAdTermsAt(application.Now())
			}
		}
		if input.SponsorshipLine != "" {
			update.SetSponsorshipLine(input.SponsorshipLine)
		}
		updated, err = update.Save(ctx)
		return err
	})
	if err != nil {
		return LiveSessionView{}, err
	}
	return application.presentLiveSession(ctx, updated)
}
