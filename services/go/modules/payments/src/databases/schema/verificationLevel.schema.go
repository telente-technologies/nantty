package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CustomerValidation struct {
	ent.Schema
}

func (CustomerValidation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CustomerValidation) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40),
		field.String("provider_customer_id").MaxLen(120).Default(""),
		field.Enum("status").Values("pending", "verified", "failed").Default("pending"),
		field.String("bank_code").MaxLen(20).Default(""),
		field.String("account_last4").MaxLen(4).Default(""),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("requested_at"),
		field.Time("decided_at").Optional().Nillable(),
		field.Int64("version").Default(0),
	}
}

func (CustomerValidation) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique(), index.Fields("provider", "provider_customer_id")}
}

type VerificationLevelRecord struct {
	ent.Schema
}

func (VerificationLevelRecord) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (VerificationLevelRecord) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int("level").Min(0).Max(2).Default(0),
		field.Bool("payout_verified").Default(false),
		field.Bool("identity_verified").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (VerificationLevelRecord) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique()}
}
