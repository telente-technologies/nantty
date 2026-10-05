package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Cart struct {
	ent.Schema
}

func (Cart) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Cart) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Cart) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}

type CartItem struct {
	ent.Schema
}

func (CartItem) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CartItem) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("cart_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.Int("quantity").Positive(),
		field.String("attribution_source").Optional().Nillable().MaxLen(10),
		field.UUID("attribution_id", uuid.UUID{}).Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CartItem) Indexes() []ent.Index {
	return []ent.Index{index.Fields("cart_id", "variant_id").Unique(), index.Fields("variant_id")}
}
