package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockLevel struct {
	ent.Schema
}

func (StockLevel) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockLevel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.UUID("location_id", uuid.UUID{}).Immutable(),
		field.Int("on_hand").Default(0),
		field.Int("reserved").Default(0),
		field.Int("low_stock_level").Default(5),
		field.Int("reorder_point").Default(5),
		field.Int("reorder_quantity").Default(10),
		field.Bool("listed").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StockLevel) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("variant_id", "location_id").Unique(),
		index.Fields("store_id", "location_id", "id"),
		index.Fields("store_id", "variant_id"),
		index.Fields("location_id"),
	}
}

func (StockLevel) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Annotation{Checks: map[string]string{
		"stock_level_on_hand_not_negative":  "on_hand >= 0",
		"stock_level_reserved_not_negative": "reserved >= 0",
	}}}
}
