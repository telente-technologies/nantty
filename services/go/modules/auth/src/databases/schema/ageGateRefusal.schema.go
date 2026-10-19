package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AgeGateRefusal struct {
	ent.Schema
}

func (AgeGateRefusal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AgeGateRefusal) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").Values("email", "device").Immutable(),
		field.String("value_hash").NotEmpty().MaxLen(64).Immutable(),
		field.Time("expires_at").Immutable(),
	}
}

func (AgeGateRefusal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("kind", "value_hash", "expires_at"), index.Fields("expires_at")}
}
