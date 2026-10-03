package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AccountRestriction struct {
	ent.Schema
}

func (AccountRestriction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AccountRestriction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Strings("features").Immutable(),
		field.String("reason").Immutable().MaxLen(1000),
		field.Time("ends_at").Immutable(),
		field.String("created_by").Immutable().MaxLen(64),
		field.String("created_by_name").Default("").Immutable().MaxLen(120),
		field.Time("lifted_at").Optional().Nillable(),
	}
}

func (AccountRestriction) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "ends_at")}
}
