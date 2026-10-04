package announceexpiredstrikes

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	strikeevents "zudomart/modules/moderation/src/modules/strikes/events"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
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
	accounts := map[uuid.UUID]bool{}
	for _, row := range due {
		err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			if err := tx.Strike.UpdateOne(row).SetExpiryAnnouncedAt(now).Exec(ctx); err != nil {
				return err
			}
			counts, err := strikeservices.ActiveCounts(ctx, tx.Client(), now, []uuid.UUID{row.AccountID})
			if err != nil {
				return err
			}
			return events.EnqueueOutboxEventInTransaction(ctx, tx, strikeevents.StrikeExpiredType, row.ID.String(), now, strikeevents.StrikeExpiredData{
				StrikeId: row.ID.String(), AccountId: row.AccountID.String(), Kind: string(row.Kind), Policy: row.Policy, Source: string(row.Source), ExpiredAt: row.ExpiresAt.UTC().Format(time.RFC3339), ActiveStrikeCount: counts[row.AccountID].ActiveStrikes,
			})
		})
		if err != nil {
			return len(accounts), err
		}
		accounts[row.AccountID] = true
	}
	for account := range accounts {
		if _, err := services.PublishHealthChanged(ctx, handler.Container, account, "strike_expired"); err != nil {
			return len(due), err
		}
	}
	return len(due), nil
}
