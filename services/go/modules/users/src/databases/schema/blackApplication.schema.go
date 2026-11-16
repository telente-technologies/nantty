package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type BlackApplication struct {
	ent.Schema
}

func (BlackApplication) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BlackApplication) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("agency_name").MaxLen(120).Immutable(),
		field.String("handle").MaxLen(30).Immutable(),
		field.String("representative_name").MaxLen(120).Immutable(),
		field.String("representative_role").MaxLen(120).Immutable(),
		field.Enum("status").Values("pending", "in_review", "awaiting_second_approval", "approved", "rejected", "reverification_required", "revoked").Default("in_review"),
		field.Bytes("checklist").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("first_approval_by").Default("").MaxLen(64),
		field.String("first_approval_by_name").Default("").MaxLen(120),
		field.Time("first_approval_at").Optional().Nillable(),
		field.String("second_approval_by").Default("").MaxLen(64),
		field.String("second_approval_by_name").Default("").MaxLen(120),
		field.Time("second_approval_at").Optional().Nillable(),
		field.String("decision_reason").Default("").MaxLen(1000),
		field.Time("reverification_due_at").Optional().Nillable(),
		field.Time("reverification_reminded_at").Optional().Nillable(),
		field.Bool("handle_reserved").Default(false),
	}
}

func (BlackApplication) Indexes() []ent.Index {
	return []ent.Index{index.Fields("status", "created_at"), index.Fields("profile_id")}
}
