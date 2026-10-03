package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type DeletionRequest struct {
	ent.Schema
}

func (DeletionRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeletionRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("status").Values("pending", "cancelled", "executing", "executed").Default("pending"),
		field.String("reason").Default("").MaxLen(300).Immutable(),
		field.Time("scheduled_for").Immutable(),
		field.Bytes("retention_snapshot").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("cancelled_at").Optional().Nillable(),
		field.Time("executed_at").Optional().Nillable(),
	}
}

func (DeletionRequest) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "status"), index.Fields("status", "scheduled_for")}
}
