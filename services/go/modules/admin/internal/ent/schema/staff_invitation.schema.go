package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffInvitation struct {
	ent.Schema
}

func (StaffInvitation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffInvitation) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("staff_id", uuid.UUID{}).Immutable(),
		field.String("token_hash").NotEmpty().Immutable().Sensitive(),
		field.Time("expires_at").Immutable(),
		field.Time("consumed_at").Optional().Nillable(),
	}
}

func (StaffInvitation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("staff", StaffAccount.Type).Ref("invitations").Field("staff_id").Unique().Required().Immutable(),
	}
}

func (StaffInvitation) Indexes() []ent.Index {
	return []ent.Index{index.Fields("token_hash").Unique()}
}
