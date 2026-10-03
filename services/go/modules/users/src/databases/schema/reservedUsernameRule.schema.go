package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ReservedUsernameRule struct {
	ent.Schema
}

func (ReservedUsernameRule) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReservedUsernameRule) Fields() []ent.Field {
	return []ent.Field{
		field.String("term").NotEmpty().MaxLen(30),
		field.Enum("match_kind").Values("exact", "prefix", "contains", "brand"),
		field.String("created_by").Default("").MaxLen(64),
	}
}

func (ReservedUsernameRule) Indexes() []ent.Index {
	return []ent.Index{index.Fields("term", "match_kind").Unique()}
}
