package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AccountTopic struct {
	ent.Schema
}

func (AccountTopic) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AccountTopic) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("topic_id").NotEmpty().MaxLen(40).Immutable(),
	}
}

func (AccountTopic) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "topic_id").Unique()}
}
