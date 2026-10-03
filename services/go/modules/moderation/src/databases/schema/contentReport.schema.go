package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ContentReport struct {
	ent.Schema
}

func (ContentReport) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ContentReport) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("target_type").Values("post", "comment", "clip", "live", "product", "store", "sound", "user").Immutable(),
		field.String("target_id").MaxLen(128).Immutable(),
		field.UUID("author_id", uuid.UUID{}).Optional().Nillable(),
		field.Enum("status").Values("open", "in_review", "resolved", "dismissed").Default("open"),
		field.Enum("priority").Values("low", "normal", "high", "urgent").Default("normal"),
		field.String("primary_reason").MaxLen(40),
		field.Bytes("reason_counts").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Int("report_count").Default(0),
		field.Time("first_reported_at").Immutable(),
		field.Time("last_reported_at"),
		field.Time("sla_due_at"),
		field.Enum("visibility").Values("visible", "hidden", "restricted", "removed").Default("visible"),
		field.Enum("source").Values("user", "classifier").Default("user").Immutable(),
		field.Bytes("target_preview").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("classifier_scores").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("classifier_action").Values("none", "allow", "reduce", "hold").Default("none"),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (ContentReport) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("target_type", "target_id").Unique(),
		index.Fields("status", "priority", "sla_due_at"),
		index.Fields("author_id"),
	}
}
