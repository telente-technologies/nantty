package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type VerificationApplication struct {
	ent.Schema
}

func (VerificationApplication) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (VerificationApplication) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold").Immutable(),
		field.String("plan_id").Default("").MaxLen(64),
		field.Enum("status").Values("pending", "approved", "rejected", "suspended", "revoked").Default("pending"),
		field.Bytes("applicant").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Strings("document_keys").Default([]string{}),
		field.String("decision_reason").Default("").MaxLen(1000),
		field.String("reviewed_by_name").Default("").MaxLen(120),
		field.Time("reviewed_at").Optional().Nillable(),
		field.Time("billing_confirmed_at").Optional().Nillable(),
	}
}

func (VerificationApplication) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id", "status"), index.Fields("status", "created_at")}
}
