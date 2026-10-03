package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ExchangeRateRevision struct {
	ent.Schema
}

func (ExchangeRateRevision) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ExchangeRateRevision) Fields() []ent.Field {
	return []ent.Field{
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("usd_rate_e8").Positive().Immutable(),
		field.String("set_by").Default("").MaxLen(64).Immutable(),
		field.String("reason").Default("").MaxLen(500).Immutable(),
		field.Enum("source").Values("seed", "admin").Immutable(),
	}
}

func (ExchangeRateRevision) Indexes() []ent.Index {
	return []ent.Index{index.Fields("currency", "created_at")}
}
