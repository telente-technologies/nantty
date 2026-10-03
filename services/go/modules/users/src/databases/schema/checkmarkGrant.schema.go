package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CheckmarkGrant struct {
	ent.Schema
}

func (CheckmarkGrant) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CheckmarkGrant) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold", "black").Immutable(),
		field.String("reason").Immutable().MaxLen(1000),
		field.String("granted_by").Immutable().MaxLen(64),
		field.String("granted_by_name").Default("").Immutable().MaxLen(120),
		field.Time("revoked_at").Optional().Nillable(),
		field.String("revoked_by_name").Default("").MaxLen(120),
		field.String("revoked_reason").Default("").MaxLen(1000),
	}
}

func (CheckmarkGrant) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id", "revoked_at"), index.Fields("revoked_at", "created_at")}
}
