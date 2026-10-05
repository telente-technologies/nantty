package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StoreDailyTraffic struct {
	ent.Schema
}

func (StoreDailyTraffic) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreDailyTraffic) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("day").NotEmpty().MaxLen(10).Immutable(),
		field.Int("store_views").Default(0),
		field.Int("product_views").Default(0),
		field.Int("visitors").Default(0),
	}
}

func (StoreDailyTraffic) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "day").Unique()}
}

type ProductDailyView struct {
	ent.Schema
}

func (ProductDailyView) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductDailyView) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.String("day").NotEmpty().MaxLen(10).Immutable(),
		field.Int("views").Default(0),
	}
}

func (ProductDailyView) Indexes() []ent.Index {
	return []ent.Index{index.Fields("product_id", "day").Unique(), index.Fields("store_id", "day")}
}
