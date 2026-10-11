package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type StepUpConsumption struct {
	ent.Schema
}

func (StepUpConsumption) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StepUpConsumption) Fields() []ent.Field {
	return []ent.Field{
		field.String("token_hash").NotEmpty().MaxLen(64).Immutable(),
		field.String("staff_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("route").MaxLen(200).Default("").Immutable(),
		field.Time("expires_at").Immutable(),
	}
}

func (StepUpConsumption) Indexes() []ent.Index {
	return []ent.Index{index.Fields("token_hash").Unique(), index.Fields("expires_at")}
}
