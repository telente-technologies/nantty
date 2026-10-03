package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type RefreshToken struct {
	ent.Schema
}

func (RefreshToken) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (RefreshToken) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("session_id", uuid.UUID{}).Immutable(),
		field.String("token_hash").NotEmpty().Immutable().Sensitive(),
		field.Time("expires_at").Immutable(),
		field.Time("used_at").Optional().Nillable(),
		field.UUID("replaced_by_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (RefreshToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("session", Session.Type).Ref("refresh_tokens").Field("session_id").Unique().Required().Immutable(),
	}
}

func (RefreshToken) Indexes() []ent.Index {
	return []ent.Index{index.Fields("token_hash").Unique()}
}
