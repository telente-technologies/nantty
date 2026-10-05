package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type OneTimeCode struct {
	ent.Schema
}

func (OneTimeCode) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OneTimeCode) Fields() []ent.Field {
	return []ent.Field{
		field.String("destination").NotEmpty().MaxLen(254).Immutable(),
		field.Enum("purpose").Values("signup", "reset", "login", "signup_verified", "reset_verified", "login_verified", "email_verification").Immutable(),
		field.String("secret_hash").NotEmpty().Immutable().Sensitive(),
		field.Time("expires_at").Immutable(),
		field.Int("failed_attempts").Default(0).NonNegative(),
		field.Time("consumed_at").Optional().Nillable(),
	}
}

func (OneTimeCode) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("destination", "purpose", "consumed_at"),
		index.Fields("secret_hash").Unique(),
	}
}
