package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PolicyVersion struct {
	ent.Schema
}

func (PolicyVersion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PolicyVersion) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").Values("privacy_policy", "cookie_policy", "terms").Immutable(),
		field.String("version").NotEmpty().MaxLen(40).Immutable(),
		field.Time("effective_at").Immutable(),
		field.String("summary").Default("").MaxLen(500).Immutable(),
		field.String("content_url").Default("").MaxLen(300).Immutable(),
		field.String("published_by").Default("").MaxLen(64).Immutable(),
	}
}

func (PolicyVersion) Indexes() []ent.Index {
	return []ent.Index{index.Fields("kind", "version").Unique(), index.Fields("kind", "effective_at")}
}
