package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type FeaturedProduct struct {
	ent.Schema
}

func (FeaturedProduct) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (FeaturedProduct) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.String("placement").NotEmpty().MaxLen(20),
		field.Int("position"),
		field.Time("featured_since").Default(time.Now),
		field.Int("view_count").Default(0),
		field.Int("click_count").Default(0),
	}
}

func (FeaturedProduct) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "product_id").Unique(), index.Fields("store_id", "position"), index.Fields("placement", "store_id")}
}

type StoreVisitor struct {
	ent.Schema
}

func (StoreVisitor) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreVisitor) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Int("visit_count").Default(1),
		field.Time("last_visited_at").Default(time.Now),
	}
}

func (StoreVisitor) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "account_id").Unique(), index.Fields("store_id", "last_visited_at"), index.Fields("account_id")}
}
