package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ProviderCustomer struct {
	ent.Schema
}

func (ProviderCustomer) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderCustomer) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_customer_id").NotEmpty().MaxLen(120).Immutable(),
	}
}

func (ProviderCustomer) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "provider").Unique(), index.Fields("provider", "provider_customer_id").Unique()}
}

type SavedCardSetup struct {
	ent.Schema
}

func (SavedCardSetup) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SavedCardSetup) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(80).Immutable(),
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_customer_id").MaxLen(120).Default(""),
		field.String("provider_checkout_id").MaxLen(120).Default(""),
		field.String("purpose").MaxLen(40).Default("device"),
		field.String("subject_id").MaxLen(80).Default(""),
		field.Enum("status").Values("pending", "saved", "delivered", "expired").Default("pending"),
		field.String("card_brand").MaxLen(30).Default(""),
		field.String("card_last4").MaxLen(4).Default(""),
		field.Int("card_expiry_month").Default(0),
		field.Int("card_expiry_year").Default(0),
		field.String("card_fingerprint_hash").MaxLen(64).Default(""),
		field.Time("saved_at").Optional().Nillable(),
	}
}

func (SavedCardSetup) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("user_id", "created_at"), index.Fields("provider_customer_id", "status")}
}
