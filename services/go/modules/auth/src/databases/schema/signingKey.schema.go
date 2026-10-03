package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SigningKey struct {
	ent.Schema
}

func (SigningKey) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Immutable(),
		field.String("algorithm").NotEmpty().Immutable(),
		field.Bytes("public_key_jwk").NotEmpty().Immutable(),
		field.Bytes("encrypted_private_key").NotEmpty().Immutable().Sensitive(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("retired_at").Optional().Nillable(),
		field.Time("published_until"),
	}
}

func (SigningKey) Indexes() []ent.Index {
	return []ent.Index{index.Fields("retired_at"), index.Fields("published_until")}
}
