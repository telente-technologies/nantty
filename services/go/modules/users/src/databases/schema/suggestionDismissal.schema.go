package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SuggestionDismissal struct {
	ent.Schema
}

func (SuggestionDismissal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SuggestionDismissal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold").Immutable(),
	}
}

func (SuggestionDismissal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id", "color").Unique()}
}
