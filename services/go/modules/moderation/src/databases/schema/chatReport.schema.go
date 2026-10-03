package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ChatReport struct {
	ent.Schema
}

func (ChatReport) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ChatReport) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("reporter_id", uuid.UUID{}).Immutable(),
		field.Enum("target_type").Values("user", "message", "conversation", "group").Immutable(),
		field.String("target_id").MaxLen(128).Immutable(),
		field.String("conversation_id").MaxLen(128).Default("").Immutable(),
		field.UUID("reported_user_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("reason").MaxLen(40).Immutable(),
		field.String("details").MaxLen(500).Default("").Immutable(),
		field.Bool("block_reported_user").Default(false).Immutable(),
		field.Bytes("evidence").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("evidence_selection").MaxLen(30).Default("").Immutable(),
		field.String("evidence_hash").MaxLen(64).Default("").Immutable(),
		field.Bool("evidence_hash_verified").Default(false).Immutable(),
		field.Enum("priority").Values("low", "normal", "high", "urgent").Default("normal").Immutable(),
		field.Enum("status").Values("open", "in_review", "actioned", "dismissed", "escalated_legal").Default("open"),
		field.Time("sla_due_at").Immutable(),
		field.Time("evidence_retained_until"),
		field.Bool("legal_hold").Default(false),
		field.Int("spam_score").Optional().Nillable(),
		field.Strings("spam_signals").Default([]string{}),
		field.String("spam_source").MaxLen(40).Default(""),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("reporter_outcome").Values("none", "action_taken", "no_violation").Default("none"),
		field.String("idempotency_key").MaxLen(128).Optional().Nillable().Immutable(),
		field.Time("evidence_purged_at").Optional().Nillable(),
	}
}

func (ChatReport) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reporter_id", "idempotency_key").Unique(),
		index.Fields("reporter_id", "created_at"),
		index.Fields("status", "priority", "sla_due_at"),
		index.Fields("reported_user_id"),
		index.Fields("evidence_retained_until", "evidence_purged_at"),
	}
}
