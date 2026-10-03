package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SocialIdentity struct {
	ent.Schema
}

func (SocialIdentity) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SocialIdentity) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("provider").Values("google", "apple").Immutable(),
		field.String("subject").NotEmpty().MaxLen(255).Immutable(),
		field.String("email").Optional().Nillable().MaxLen(254).Immutable(),
	}
}

func (SocialIdentity) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("account", Account.Type).Ref("social_identities").Field("account_id").Unique().Required().Immutable(),
	}
}

func (SocialIdentity) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider", "subject").Unique(),
		index.Fields("account_id"),
	}
}
