package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SellerCreditMaturity struct {
	ent.Schema
}

func (SellerCreditMaturity) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"seller_credit_maturities_remaining_within_original": "original_amount_minor > 0 AND remaining_amount_minor >= 0 AND remaining_amount_minor <= original_amount_minor",
	})}
}

func (SellerCreditMaturity) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SellerCreditMaturity) Fields() []ent.Field {
	return []ent.Field{
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("source_reference").NotEmpty().MaxLen(255).Immutable(),
		field.Int64("original_amount_minor").Immutable(),
		field.Int64("remaining_amount_minor"),
		field.Time("available_at").Immutable(),
		field.Time("matured_at").Optional().Nillable(),
	}
}

func (SellerCreditMaturity) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source_reference").Unique(),
		index.Fields("matured_at", "available_at"),
		index.Fields("seller_user_id", "currency", "matured_at"),
	}
}
