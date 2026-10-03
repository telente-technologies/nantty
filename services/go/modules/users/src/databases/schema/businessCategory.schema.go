package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type BusinessCategory struct {
	ent.Schema
}

func (BusinessCategory) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BusinessCategory) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("parent_id", uuid.UUID{}).Optional().Nillable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("slug").NotEmpty().MaxLen(80),
		field.Enum("status").Values("active", "pending_review", "rejected").Default("active"),
		field.UUID("created_by_account_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (BusinessCategory) Edges() []ent.Edge {
	return []ent.Edge{edge.From("profiles", Profile.Type).Ref("categories")}
}

func (BusinessCategory) Indexes() []ent.Index {
	return []ent.Index{index.Fields("slug").Unique(), index.Fields("parent_id")}
}
