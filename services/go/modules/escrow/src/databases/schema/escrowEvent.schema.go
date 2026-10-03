package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type EscrowEvent struct {
	ent.Schema
}

func (EscrowEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (EscrowEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("escrow_id", uuid.UUID{}).Immutable(),
		field.String("event_type").NotEmpty().MaxLen(60).Immutable(),
		field.String("actor_type").MaxLen(20).Default("system").Immutable(),
		field.String("actor_id").MaxLen(80).Default("").Immutable(),
		field.Bytes("details").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (EscrowEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("escrow_id", "created_at")}
}
