package listtopics

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/topic"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]*ent.Topic, error) {
	return handler.Container.Client.Topic.Query().Where(topic.Active(true)).Order(ent.Asc(topic.FieldPosition), ent.Asc(topic.FieldID)).All(ctx)
}
