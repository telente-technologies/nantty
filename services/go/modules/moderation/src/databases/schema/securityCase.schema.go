package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SecurityCase struct {
	ent.Schema
}

func (SecurityCase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SecurityCase) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("trigger").Values("access_probing", "suspected_bot").Immutable(),
		field.Enum("status").Values("open", "cleared", "kept_restricted", "suspended", "banned", "deleted").Default("open"),
		field.Enum("severity").Values("low", "medium", "high").Default("medium"),
		field.Int("violation_count").Default(0),
		field.Int("failed_challenge_count").Default(0),
		field.Int("passed_challenge_count").Default(0),
		field.Bool("auto_suspended").Default(false),
		field.Time("last_activity_at").Default(time.Now),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("decided_at").Optional().Nillable(),
	}
}

func (SecurityCase) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id").Unique().Annotations(entsql.IndexWhere("status = 'open'")).StorageKey("securitycase_open_account_id"),
		index.Fields("status", "severity", "last_activity_at"),
		index.Fields("account_id", "created_at"),
	}
}
