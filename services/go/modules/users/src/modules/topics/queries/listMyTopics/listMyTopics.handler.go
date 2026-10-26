package listmytopics

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accounttopic"
	"nantty/modules/users/src/generated/ent/topic"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.Topic, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return nil, usersErrors.ErrAccountUnavailable
	}
	selected, err := handler.Container.Client.AccountTopic.Query().Where(accounttopic.AccountID(owner)).Select(accounttopic.FieldTopicID).Strings(ctx)
	if err != nil || len(selected) == 0 {
		return []*ent.Topic{}, err
	}
	return handler.Container.Client.Topic.Query().Where(topic.IDIn(selected...), topic.Active(true)).Order(ent.Asc(topic.FieldPosition), ent.Asc(topic.FieldID)).All(ctx)
}
