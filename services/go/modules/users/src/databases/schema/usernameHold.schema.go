package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type UsernameHold struct {
	ent.Schema
}

func (UsernameHold) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (UsernameHold) Fields() []ent.Field {
	return []ent.Field{
		field.String("username").NotEmpty().MaxLen(30),
		field.Enum("kind").Values("withheld", "quarantine", "reserved_official"),
		field.UUID("held_for_account_id", uuid.UUID{}).Optional().Nillable(),
		field.String("reason").Default("").MaxLen(120),
		field.String("note").Default("").MaxLen(500),
		field.String("created_by").Default("").MaxLen(64),
		field.String("created_by_name").Default("").MaxLen(120),
		field.Time("expires_at").Optional().Nillable(),
	}
}

func (UsernameHold) Indexes() []ent.Index {
	return []ent.Index{index.Fields("username").Unique()}
}
