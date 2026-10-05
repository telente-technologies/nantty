package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type RegistrationBlock struct {
	ent.Schema
}

func (RegistrationBlock) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (RegistrationBlock) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").Values("email", "device").Immutable(),
		field.String("value_hash").NotEmpty().MaxLen(64).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("reason").Default("").MaxLen(500).Immutable(),
		field.String("created_by").Default("").MaxLen(64).Immutable(),
		field.Time("lifted_at").Optional().Nillable(),
	}
}

func (RegistrationBlock) Indexes() []ent.Index {
	return []ent.Index{index.Fields("kind", "value_hash", "lifted_at"), index.Fields("account_id")}
}
