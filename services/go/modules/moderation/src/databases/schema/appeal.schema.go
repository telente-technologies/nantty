package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Appeal struct {
	ent.Schema
}

func (Appeal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Appeal) Fields() []ent.Field {
	return []ent.Field{
		field.String("source_key").MaxLen(200).Immutable(),
		field.Enum("decision_type").Values("content_removed", "content_restricted", "strike", "suspension", "copyright_takedown").Immutable(),
		field.UUID("appellant_id", uuid.UUID{}).Immutable(),
		field.UUID("report_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("strike_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("target_type").MaxLen(40).Immutable(),
		field.String("target_id").MaxLen(128).Immutable(),
		field.Bytes("target").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("original_decision").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.String("statement").MaxLen(2000).Immutable(),
		field.Strings("evidence_notes").Default([]string{}).Immutable(),
		field.Enum("status").Values("pending", "upheld", "overturned").Default("pending"),
		field.Time("submitted_at").Immutable(),
		field.Time("sla_due_at").Immutable(),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (Appeal) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source_key").Unique(),
		index.Fields("status", "sla_due_at"),
		index.Fields("appellant_id"),
		index.Fields("strike_id"),
	}
}
