package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SecurityEvent struct {
	ent.Schema
}

func (SecurityEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SecurityEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Enum("kind").Values(
			"access_violation", "challenge_required", "challenge_passed", "challenge_failed", "bot_score_recorded", "bot_marked", "bot_cleared",
			"client_signals", "auto_suspended", "case_opened", "case_decided",
		).Immutable(),
		field.String("device_id").MaxLen(128).Default("").Immutable(),
		field.String("ip_prefix").MaxLen(64).Default("").Immutable(),
		field.String("source").MaxLen(40).Default("").Immutable(),
		field.String("external_reference").MaxLen(128).Optional().Nillable().Immutable(),
		field.Bytes("detail").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (SecurityEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("external_reference").Unique(), index.Fields("account_id", "created_at"), index.Fields("account_id", "kind", "created_at")}
}
