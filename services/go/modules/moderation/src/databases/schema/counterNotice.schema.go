package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CounterNotice struct {
	ent.Schema
}

func (CounterNotice) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CounterNotice) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("claim_id", uuid.UUID{}).Immutable(),
		field.UUID("submitter_id", uuid.UUID{}).Immutable(),
		field.String("statement").MaxLen(2000).Immutable(),
		field.String("contact_email").MaxLen(254).Immutable(),
		field.Enum("status").Values("pending", "accepted", "rejected").Default("pending"),
		field.Time("restore_eligible_at"),
		field.Bool("court_action_recorded").Default(false),
		field.String("decided_by_id").MaxLen(64).Default(""),
		field.String("decision_reason").MaxLen(1000).Default(""),
		field.Time("decided_at").Optional().Nillable(),
		field.Time("restored_at").Optional().Nillable(),
	}
}

func (CounterNotice) Indexes() []ent.Index {
	return []ent.Index{index.Fields("claim_id", "status"), index.Fields("status", "restore_eligible_at")}
}
