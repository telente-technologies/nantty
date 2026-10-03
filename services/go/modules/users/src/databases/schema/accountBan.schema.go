package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AccountBan struct {
	ent.Schema
}

func (AccountBan) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AccountBan) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("reason").Immutable().MaxLen(1000),
		field.Time("ends_at").Optional().Nillable().Immutable(),
		field.String("banned_by").Immutable().MaxLen(64),
		field.String("banned_by_name").Default("").Immutable().MaxLen(120),
		field.Time("lifted_at").Optional().Nillable(),
		field.String("lifted_by").Default("").MaxLen(64),
	}
}

func (AccountBan) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "lifted_at"), index.Fields("lifted_at", "ends_at")}
}
