package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdminCreatedAccount struct {
	ent.Schema
}

func (AdminCreatedAccount) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AdminCreatedAccount) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("profile_type").Values("personal", "business", "brand", "government").Immutable(),
		field.String("created_by").Immutable().MaxLen(64),
		field.String("created_by_name").Default("").Immutable().MaxLen(120),
		field.String("reason").Immutable().MaxLen(1000),
		field.Strings("bypassed_reserved_entries").Immutable(),
	}
}

func (AdminCreatedAccount) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id").Unique()}
}
