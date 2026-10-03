package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type UserConsent struct {
	ent.Schema
}

func (UserConsent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (UserConsent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("device_id").Optional().Nillable().MaxLen(128).Immutable(),
		field.Enum("consent_type").Values("essential", "analytics", "personalization", "advertising", "marketing").Immutable(),
		field.Enum("status").Values("granted", "withdrawn").Immutable(),
		field.String("policy_version").NotEmpty().MaxLen(40).Immutable(),
		field.Time("consented_at").Immutable(),
		field.Time("withdrawn_at").Optional().Nillable().Immutable(),
		field.String("ip_address").Default("").MaxLen(64).Immutable(),
		field.String("user_agent").Default("").MaxLen(255).Immutable(),
		field.String("source").Default("direct").MaxLen(20).Immutable(),
	}
}

func (UserConsent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "consent_type", "created_at"),
		index.Fields("device_id", "consent_type", "created_at"),
	}
}
