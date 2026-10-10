package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type OrderPayable struct {
	ent.Schema
}

func (OrderPayable) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"order_payables_amount_positive": "amount_minor > 0"})}
}

func (OrderPayable) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OrderPayable) Fields() []ent.Field {
	return []ent.Field{
		field.String("checkout_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("order_reference").NotEmpty().MaxLen(80).Immutable(),
		field.String("buyer_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("product_summary").MaxLen(300).Default("").Immutable(),
		field.Enum("payment_mode").Values("escrow", "direct").Default("escrow").Immutable(),
		field.Bool("store_verified").Default(false).Immutable(),
	}
}

func (OrderPayable) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_id").Unique(), index.Fields("checkout_id"), index.Fields("seller_user_id", "currency", "created_at")}
}
