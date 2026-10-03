package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AuditEvent struct {
	ent.Schema
}

func (AuditEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AuditEvent) Fields() []ent.Field {
	return []ent.Field{
		field.String("actor_id").NotEmpty().Immutable().MaxLen(64),
		field.String("actor_role").Default("").Immutable().MaxLen(32),
		field.String("action").NotEmpty().Immutable().MaxLen(100),
		field.String("subject_type").Default("").Immutable().MaxLen(64),
		field.String("subject_id").Default("").Immutable().MaxLen(128),
		field.Bytes("before").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("after").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("reason").Default("").Immutable().MaxLen(500),
		field.String("ip_address").Default("").Immutable().MaxLen(64),
		field.String("user_agent").Default("").Immutable().MaxLen(255),
		field.String("request_id").Default("").Immutable().MaxLen(64),
	}
}

func (AuditEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("action", "created_at"),
		index.Fields("actor_id", "created_at"),
		index.Fields("subject_type", "subject_id"),
	}
}
