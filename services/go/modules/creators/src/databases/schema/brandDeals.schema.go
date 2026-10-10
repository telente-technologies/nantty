package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CreatorBrandDeal struct {
	ent.Schema
}

func (CreatorBrandDeal) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"creator_brand_deals_amount_not_negative": "amount_minor >= 0",
		"creator_brand_deals_ends_after_start":    "ends_at IS NULL OR ends_at >= starts_at",
	})}
}

func (CreatorBrandDeal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorBrandDeal) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("brand_name").NotEmpty().MaxLen(120),
		field.Int64("amount_minor"),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Time("starts_at"),
		field.Time("ends_at").Optional().Nillable(),
		field.String("disclosure").NotEmpty().MaxLen(500),
		field.String("notes").MaxLen(1000).Default(""),
		field.String("idempotency_key").NotEmpty().MaxLen(128).Immutable(),
	}
}

func (CreatorBrandDeal) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("creator_user_id", "created_at"),
		index.Fields("creator_user_id", "idempotency_key").Unique(),
	}
}
