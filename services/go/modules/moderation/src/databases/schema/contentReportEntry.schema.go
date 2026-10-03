package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ContentReportEntry struct {
	ent.Schema
}

func (ContentReportEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ContentReportEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("report_id", uuid.UUID{}).Immutable(),
		field.UUID("reporter_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("reason").MaxLen(40).Immutable(),
		field.String("details").MaxLen(500).Default("").Immutable(),
		field.Enum("source").Values("user", "classifier").Default("user").Immutable(),
		field.String("source_event_id").MaxLen(128).Optional().Nillable().Immutable(),
	}
}

func (ContentReportEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("report_id", "reporter_id").Unique(),
		index.Fields("source_event_id").Unique(),
		index.Fields("reporter_id", "created_at"),
	}
}
