package services

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
)

type ActivityActor struct {
	UserId string
	Name   string
}

func RecordActivityInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, objectType, objectId string, actor ActivityActor, summary string, changes any) error {
	encoded, err := json.Marshal(changes)
	if err != nil {
		return err
	}
	if changes == nil {
		encoded = []byte("null")
	}
	return tx.AdActivityEntry.Create().SetAccountID(accountId).SetObjectType(objectType).SetObjectID(objectId).SetActorUserID(actor.UserId).SetActorName(actor.Name).SetSummary(summary).SetChanges(encoded).Exec(ctx)
}
