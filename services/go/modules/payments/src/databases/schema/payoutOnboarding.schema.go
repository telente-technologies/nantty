package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PayoutOnboarding struct {
	ent.Schema
}

func (PayoutOnboarding) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PayoutOnboarding) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("role").MaxLen(20).Default("creator"),
		field.String("legal_name").MaxLen(160).Default(""),
		field.Bytes("sealed_identity").Optional().Nillable().Sensitive(),
		field.String("id_type").MaxLen(10).Default(""),
		field.String("id_last4").MaxLen(4).Default(""),
		field.Bool("registered_business").Default(false),
		field.String("cac_number").MaxLen(40).Default(""),
		field.String("business_type").MaxLen(60).Default(""),
		field.String("bank_code").MaxLen(20).Default(""),
		field.String("bank_name").MaxLen(120).Default(""),
		field.String("account_last4").MaxLen(4).Default(""),
		field.String("resolved_account_name").MaxLen(160).Default(""),
		field.Strings("completed_steps").Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PayoutOnboarding) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique()}
}
