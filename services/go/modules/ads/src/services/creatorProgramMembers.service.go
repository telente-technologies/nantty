package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreatorprogrammember"
	platformevents "nantty/platform/events"
)

const (
	CreatorApplicationDecided = "creatorApplication.decided"
	CreatorStandingChanged    = "creator.standingChanged"
)

type CreatorProgramMembers struct {
	Client *ent.Client
	Now    func() time.Time
}

func (members CreatorProgramMembers) Apply(ctx context.Context, userId string, approved bool, occurredAt time.Time) error {
	existing, err := members.Client.AdCreatorProgramMember.Get(ctx, userId)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if existing != nil && occurredAt.Before(existing.StatusChangedAt) {
		return nil
	}
	return members.Client.AdCreatorProgramMember.Create().SetID(userId).SetApproved(approved).SetStatusChangedAt(occurredAt).SetUpdatedAt(members.Now().UTC()).
		OnConflictColumns(adcreatorprogrammember.FieldID).UpdateNewValues().Exec(ctx)
}

func (members CreatorProgramMembers) IsCreatorPaidForCommentThreadAds(ctx context.Context, userId string, signalSaysEligible bool) (bool, error) {
	if userId == "" {
		return false, nil
	}
	row, err := members.Client.AdCreatorProgramMember.Get(ctx, userId)
	if ent.IsNotFound(err) {
		return signalSaysEligible, nil
	}
	if err != nil {
		return false, err
	}
	return row.Approved, nil
}

func (members CreatorProgramMembers) HandleCreatorProgramMessage(ctx context.Context, envelope platformevents.EventEnvelope) error {
	switch envelope.Type {
	case CreatorApplicationDecided:
		var data struct {
			AccountId string `json:"accountId"`
			Status    string `json:"status"`
		}
		if err := json.Unmarshal(envelope.Data, &data); err != nil || data.AccountId == "" {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		if data.Status != "approved" {
			return nil
		}
		return members.Apply(ctx, data.AccountId, true, envelope.OccurredAt)
	case CreatorStandingChanged:
		var data struct {
			UserId string `json:"userId"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(envelope.Data, &data); err != nil || data.UserId == "" || (data.Status != "approved" && data.Status != "suspended") {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		return members.Apply(ctx, data.UserId, data.Status == "approved", envelope.OccurredAt)
	}
	return nil
}
