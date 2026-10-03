package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockAdjustment struct {
	ent.Schema
}

func (StockAdjustment) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockAdjustment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("location_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.UUID("batch_id", uuid.UUID{}).Immutable(),
		field.String("reason").NotEmpty().Immutable(),
		field.String("note").Default("").MaxLen(500).Immutable(),
		field.Int("quantity_delta").Immutable(),
		field.Int("quantity_before").Immutable(),
		field.Int("quantity_after").Immutable(),
		field.UUID("actor_account_id", uuid.UUID{}).Immutable(),
		field.String("actor_name").Default("").MaxLen(80).Immutable(),
	}
}

func (StockAdjustment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "id"),
		index.Fields("store_id", "location_id", "id"),
		index.Fields("store_id", "reason", "id"),
		index.Fields("batch_id"),
	}
}
