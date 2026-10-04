package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LiveSafetySignal struct {
	ent.Schema
}

func (LiveSafetySignal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveSafetySignal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("incident_id", uuid.UUID{}).Immutable(),
		field.String("live_id").MaxLen(128).Immutable(),
		field.Enum("kind").Values("frame", "transcript", "report").Immutable(),
		field.String("source_key").MaxLen(160).Immutable(),
		field.String("frame_ref").MaxLen(512).Default("").Immutable(),
		field.Time("captured_at").Optional().Nillable().Immutable(),
		field.Bytes("labels").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.Bytes("categories").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.Float("confidence").Default(0).Immutable(),
		field.String("suggested_action").MaxLen(20).Default("").Immutable(),
		field.String("model_version").MaxLen(120).Default("").Immutable(),
		field.String("action_taken").MaxLen(20).Default("none").Immutable(),
		field.String("transcript_snippet").MaxLen(1000).Default("").Immutable(),
		field.String("reason").MaxLen(40).Default("").Immutable(),
		field.String("details").MaxLen(500).Default("").Immutable(),
		field.UUID("reporter_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Float("offset_seconds").Optional().Nillable().Immutable(),
		field.Bool("hash_match").Default(false).Immutable(),
	}
}

func (LiveSafetySignal) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source_key").Unique(),
		index.Fields("incident_id", "created_at"),
		index.Fields("live_id", "kind", "created_at"),
	}
}
