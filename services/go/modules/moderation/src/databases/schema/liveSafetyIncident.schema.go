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

type LiveSafetyIncident struct {
	ent.Schema
}

func (LiveSafetyIncident) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveSafetyIncident) Fields() []ent.Field {
	return []ent.Field{
		field.String("live_id").MaxLen(128).Immutable(),
		field.UUID("host_id", uuid.UUID{}).Optional().Nillable(),
		field.Enum("status").Values("open", "closed").Default("open"),
		field.Enum("priority").Values("low", "normal", "high", "urgent").Default("normal"),
		field.Time("sla_due_at"),
		field.Bool("hold_active").Default(false),
		field.String("hold_category").MaxLen(40).Default(""),
		field.String("hold_reason").MaxLen(300).Default(""),
		field.String("hold_source").MaxLen(20).Default(""),
		field.Time("hold_started_at").Optional().Nillable(),
		field.String("top_category").MaxLen(40).Default(""),
		field.Float("top_confidence").Default(0),
		field.Int("warning_count").Default(0),
		field.Time("last_warned_at").Optional().Nillable(),
		field.Int("report_count").Default(0),
		field.Time("last_reported_at").Optional().Nillable(),
		field.Time("sampling_boost_until").Optional().Nillable(),
		field.Bool("hash_match").Default(false),
		field.Time("appealed_at").Optional().Nillable(),
		field.String("appeal_message").MaxLen(1000).Default(""),
		field.Time("live_ended_at").Optional().Nillable(),
		field.String("resolution").MaxLen(40).Default(""),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LiveSafetyIncident) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id").Unique().Annotations(entsql.IndexWhere("status = 'open'")).StorageKey("livesafetyincident_open_live_id"),
		index.Fields("status", "priority", "sla_due_at"),
		index.Fields("host_id", "created_at"),
	}
}
