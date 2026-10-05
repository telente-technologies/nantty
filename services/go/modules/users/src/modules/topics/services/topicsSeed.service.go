package services

import (
	"context"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/topics/constants"
)

func SeedTopicsIfMissing(ctx context.Context, client *ent.Client) error {
	existing, err := client.Topic.Query().IDs(ctx)
	if err != nil {
		return err
	}
	known := make(map[string]bool, len(existing))
	for _, id := range existing {
		known[id] = true
	}
	for position, topic := range constants.SeedTopics {
		if known[topic.Id] {
			continue
		}
		if err := client.Topic.Create().SetID(topic.Id).SetName(topic.Name).SetPosition(position).Exec(ctx); err != nil && !ent.IsConstraintError(err) {
			return err
		}
	}
	return nil
}
