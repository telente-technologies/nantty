package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type OutboxEvent struct {
	ent.Schema
}

func (OutboxEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OutboxEvent) Fields() []ent.Field {
	return []ent.Field{
		field.String("event_type").NotEmpty().Immutable(),
		field.String("subject").Immutable(),
		field.Bytes("payload").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("published_at").Optional().Nillable(),
		field.Int("attempt_count").Default(0),
		field.Time("next_attempt_at").Optional().Nillable(),
		field.String("last_error").MaxLen(1000).Default(""),
		field.Time("dead_lettered_at").Optional().Nillable(),
	}
}

func (OutboxEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("published_at", "created_at")}
}
