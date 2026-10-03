package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type StorePurchase struct {
	ent.Schema
}

func (StorePurchase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StorePurchase) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("store").Values("apple_iap", "google_play").Immutable(),
		field.String("store_transaction_id").NotEmpty().MaxLen(200).Immutable(),
		field.String("original_transaction_id").MaxLen(200).Default("").Immutable(),
		field.String("product_id").NotEmpty().MaxLen(200).Immutable(),
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("purpose").NotEmpty().MaxLen(40).Immutable(),
		field.String("subject_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("price_minor").NonNegative().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("store_fee_minor").NonNegative().Immutable(),
		field.String("environment").MaxLen(20).Default("production").Immutable(),
		field.Enum("status").Values("verified", "refunded").Default("verified"),
		field.Time("refunded_at").Optional().Nillable(),
	}
}

func (StorePurchase) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store", "store_transaction_id").Unique(), index.Fields("user_id", "created_at")}
}
