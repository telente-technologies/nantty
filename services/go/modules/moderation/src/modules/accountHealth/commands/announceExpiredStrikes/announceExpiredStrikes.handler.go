package announceexpiredstrikes

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/strike"
	"nantty/modules/moderation/src/modules/accountHealth/services"
	strikeevents "nantty/modules/moderation/src/modules/strikes/events"
	strikeservices "nantty/modules/moderation/src/modules/strikes/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (int, error) {
	now := handler.Container.Now()
	due, err := handler.Container.Client.Strike.Query().Where(strike.RevokedAtIsNil(), strike.ExpiryAnnouncedAtIsNil(), strike.ExpiresAtNotNil(), strike.ExpiresAtLTE(now)).Limit(200).All(ctx)
	if err != nil {
		return 0, err
	}
	expired := 0
	for _, row := range due {
		err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			if err := tx.Strike.UpdateOne(row).SetExpiryAnnouncedAt(now).Exec(ctx); err != nil {
				return err
			}
			counts, err := strikeservices.ActiveCounts(ctx, tx.Client(), now, []uuid.UUID{row.AccountID})
			if err != nil {
				return err
			}
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeExpiredType, row.ID.String(), now, strikeevents.StrikeExpiredData{
				StrikeId: row.ID.String(), AccountId: row.AccountID.String(), Kind: string(row.Kind), Policy: row.Policy, Source: string(row.Source), ExpiredAt: row.ExpiresAt.UTC().Format(time.RFC3339), ActiveStrikeCount: counts[row.AccountID].ActiveStrikes,
			}); err != nil {
				return err
			}
			_, err = services.EnqueueHealthChangedInTransaction(ctx, tx, row.AccountID, now, "strike_expired")
			return err
		})
		if err != nil {
			return expired, err
		}
		expired++
	}
	return expired, nil
}
