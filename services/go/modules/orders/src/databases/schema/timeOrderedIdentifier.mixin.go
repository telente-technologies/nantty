package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
	"github.com/google/uuid"
)

type TimeOrderedIdentifierMixin struct {
	mixin.Schema
}

func (TimeOrderedIdentifierMixin) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(NewTimeOrderedUuid).Immutable(),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func NewTimeOrderedUuid() uuid.UUID {
	identifier, err := uuid.NewV7()
	if err != nil {
		return uuid.New()
	}
	return identifier
}
