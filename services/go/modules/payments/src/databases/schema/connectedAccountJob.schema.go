package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ConnectedAccountJob struct {
	ent.Schema
}

func (ConnectedAccountJob) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ConnectedAccountJob) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("step").Values("createRecipient", "createSettlementSubaccount", "createEscrowSubaccount", "refreshStatus").Immutable(),
		field.Int("version").Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(160).Immutable(),
		field.Enum("status").Values("queued", "running", "succeeded", "failed").Default("queued"),
		field.Int("attempt_count").Default(0),
		field.Time("next_attempt_at"),
		field.Time("last_attempt_at").Optional().Nillable(),
		field.String("last_error").MaxLen(500).Default(""),
		field.Bytes("sealed_payload").Optional().Nillable().Sensitive(),
		field.Bytes("sealed_result").Optional().Nillable().Sensitive(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ConnectedAccountJob) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "step", "version").Unique(),
		index.Fields("idempotency_key").Unique(),
		index.Fields("next_attempt_at").Annotations(entsql.IndexWhere("status = 'queued'")).StorageKey("connected_account_jobs_due"),
		index.Fields("status", "updated_at"),
	}
}
