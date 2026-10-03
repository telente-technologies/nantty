package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type JournalEntry struct {
	ent.Schema
}

func (JournalEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (JournalEntry) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(255).Immutable(),
		field.String("kind").NotEmpty().MaxLen(80).Immutable(),
		field.String("description").MaxLen(500).Default("").Immutable(),
		field.String("external_reference").MaxLen(255).Default("").Immutable(),
		field.UUID("reverses_entry_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Bytes("metadata").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("posted_at").Immutable(),
	}
}

func (JournalEntry) Edges() []ent.Edge {
	return []ent.Edge{edge.To("lines", JournalLine.Type)}
}

func (JournalEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("reverses_entry_id").Unique(),
		index.Fields("external_reference"),
		index.Fields("kind", "posted_at"),
	}
}

func (JournalEntry) Hooks() []ent.Hook {
	return []ent.Hook{rejectUpdatesAndDeletesOfPostedRows()}
}
