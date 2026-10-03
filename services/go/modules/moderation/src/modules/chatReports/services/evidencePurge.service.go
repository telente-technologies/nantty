package services

import (
	"context"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/chatreport"
)

type EvidencePurger struct {
	Container *container.Container
}

func (purger EvidencePurger) RunOnce(ctx context.Context) error {
	now := purger.Container.Now()
	due, err := purger.Container.Client.ChatReport.Query().Where(chatreport.EvidenceRetainedUntilLTE(now), chatreport.EvidencePurgedAtIsNil(), chatreport.LegalHold(false)).Limit(50).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range due {
		err := purger.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			if err := tx.ChatReport.UpdateOne(row).ClearEvidence().SetEvidencePurgedAt(now).Exec(ctx); err != nil {
				return err
			}
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "chatReport.evidencePurged", row.ID.String(), now, map[string]string{"reportId": row.ID.String()})
		})
		if err != nil {
			return err
		}
	}
	return nil
}
