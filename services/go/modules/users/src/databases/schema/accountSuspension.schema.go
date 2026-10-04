package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AccountSuspension struct {
	ent.Schema
}

func (AccountSuspension) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AccountSuspension) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("source").Values("staff", "python_suggestion", "user_reports", "chat_report", "security").Default("staff").Immutable(),
		field.String("reason_code").Default("OTHER").MaxLen(40),
		field.String("note").Default("").MaxLen(1000),
		field.String("suspended_by").Default("").MaxLen(64),
		field.String("suspended_by_name").Default("").MaxLen(120),
		field.Time("ends_at").Optional().Nillable(),
		field.Time("deletion_due_at"),
		field.Enum("status").Values("active", "reinstated", "deleted").Default("active"),
		field.Time("closed_at").Optional().Nillable(),
		field.Enum("appeal_status").Values("none", "pending", "upheld", "overturned").Default("none"),
		field.String("appeal_message").Default("").MaxLen(2000),
		field.Time("appeal_submitted_at").Optional().Nillable(),
		field.String("appeal_decision_note").Default("").MaxLen(1000),
		field.String("appeal_decided_by").Default("").MaxLen(64),
	}
}

func (AccountSuspension) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "status"), index.Fields("status", "deletion_due_at"), index.Fields("appeal_status", "status")}
}
