package savemytopics

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accounttopic"
	"nantty/modules/users/src/generated/ent/topic"
	"nantty/modules/users/src/modules/topics/constants"
	topicevents "nantty/modules/users/src/modules/topics/events"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) ([]*ent.Topic, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return nil, usersErrors.ErrAccountUnavailable
	}
	unique := uniqueTopicIds(command.TopicIds)
	if len(unique) < constants.MinimumSelectedTopics || len(unique) > constants.MaximumSelectedTopics {
		return nil, usersErrors.ValidationFailedFor("topicIds", fmt.Sprintf("Pick %d to %d different topics.", constants.MinimumSelectedTopics, constants.MaximumSelectedTopics))
	}
	known, err := handler.Container.Client.Topic.Query().Where(topic.IDIn(unique...), topic.Active(true)).Order(ent.Asc(topic.FieldPosition), ent.Asc(topic.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	if len(known) != len(unique) {
		return nil, usersErrors.UnprocessableWithCode("UNKNOWN_TOPIC", "One or more topics do not exist.")
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.AccountTopic.Delete().Where(accounttopic.AccountID(owner)).Exec(ctx); err != nil {
			return err
		}
		builders := make([]*ent.AccountTopicCreate, 0, len(known))
		ids := make([]string, 0, len(known))
		for _, row := range known {
			builders = append(builders, tx.AccountTopic.Create().SetAccountID(owner).SetTopicID(row.ID))
			ids = append(ids, row.ID)
		}
		if err := tx.AccountTopic.CreateBulk(builders...).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, topicevents.TopicsSelectedType, owner.String(), now, topicevents.TopicsSelectedData{
			AccountId: owner.String(), TopicIds: ids, SelectedAt: now.UTC().Format(time.RFC3339),
		})
	})
	return known, err
}

func uniqueTopicIds(raw []string) []string {
	seen := map[string]bool{}
	unique := make([]string, 0, len(raw))
	for _, id := range raw {
		normalized := strings.ToLower(strings.TrimSpace(id))
		if normalized != "" && !seen[normalized] {
			seen[normalized] = true
			unique = append(unique, normalized)
		}
	}
	return unique
}
