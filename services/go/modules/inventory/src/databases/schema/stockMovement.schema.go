package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockMovement struct {
	ent.Schema
}

func (StockMovement) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockMovement) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.UUID("location_id", uuid.UUID{}).Immutable(),
		field.String("kind").NotEmpty().Immutable(),
		field.Int("on_hand_delta").Immutable(),
		field.Int("reserved_delta").Default(0).Immutable(),
		field.String("reference").Default("").MaxLen(120).Immutable(),
		field.String("reason").Default("").MaxLen(40).Immutable(),
		field.String("note").Default("").MaxLen(500).Immutable(),
		field.UUID("actor_account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("actor_name").Default("").MaxLen(80).Immutable(),
		field.String("dedupe_key").Optional().Nillable().Unique().Immutable(),
	}
}

func (StockMovement) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "id"),
		index.Fields("store_id", "location_id", "id"),
		index.Fields("variant_id", "id"),
		index.Fields("store_id", "kind", "id"),
	}
}
