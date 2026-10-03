package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AccountRemoval struct {
	ent.Schema
}

func (AccountRemoval) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AccountRemoval) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("username").Immutable().MaxLen(30),
		field.Enum("trigger").Values("admin_delete", "suspension_expired").Immutable(),
		field.String("reason").Default("").Immutable().MaxLen(1000),
		field.String("deleted_by").Default("").Immutable().MaxLen(64),
		field.Bytes("applied_steps").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("retained_until").Immutable(),
	}
}

func (AccountRemoval) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id")}
}
