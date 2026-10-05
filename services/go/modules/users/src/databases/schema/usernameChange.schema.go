package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type UsernameChange struct {
	ent.Schema
}

func (UsernameChange) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (UsernameChange) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("previous_username").Immutable().MaxLen(30),
		field.String("new_username").Immutable().MaxLen(30),
		field.Enum("reason").Values("signup", "user_change", "admin_change", "admin_reassigned_away", "admin_reassigned_to", "admin_assigned_held", "admin_withheld", "admin_restored", "admin_reclaimed_to").Immutable(),
	}
}

func (UsernameChange) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at")}
}
