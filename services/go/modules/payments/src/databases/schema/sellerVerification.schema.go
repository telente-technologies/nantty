package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SellerVerification struct {
	ent.Schema
}

func (SellerVerification) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SellerVerification) Fields() []ent.Field {
	return []ent.Field{
		field.String("account_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("source").NotEmpty().MaxLen(60),
		field.String("event_id").MaxLen(80).Default(""),
		field.Time("verified_at"),
		field.Time("revoked_at").Optional().Nillable(),
		field.String("revoked_event_id").MaxLen(80).Default(""),
	}
}

func (SellerVerification) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}
