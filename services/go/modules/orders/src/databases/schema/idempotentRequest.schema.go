package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type IdempotentRequest struct {
	ent.Schema
}

func (IdempotentRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (IdempotentRequest) Fields() []ent.Field {
	return []ent.Field{
		field.String("scope").NotEmpty().MaxLen(200).Immutable(),
		field.String("key").NotEmpty().MaxLen(128).Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
		field.Bytes("response_body").Optional().Nillable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (IdempotentRequest) Indexes() []ent.Index {
	return []ent.Index{index.Fields("scope", "key").Unique()}
}
