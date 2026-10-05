package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffLoginChallenge struct {
	ent.Schema
}

func (StaffLoginChallenge) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffLoginChallenge) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("staff_id", uuid.UUID{}).Immutable(),
		field.String("token_hash").NotEmpty().Immutable().Sensitive(),
		field.Enum("purpose").Values("login", "enroll").Immutable(),
		field.Time("expires_at").Immutable(),
		field.Time("consumed_at").Optional().Nillable(),
		field.Int("attempts").Default(0).NonNegative(),
		field.Bytes("webauthn_session").Optional().Sensitive(),
	}
}

func (StaffLoginChallenge) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("staff", StaffAccount.Type).Ref("challenges").Field("staff_id").Unique().Required().Immutable(),
	}
}

func (StaffLoginChallenge) Indexes() []ent.Index {
	return []ent.Index{index.Fields("token_hash").Unique()}
}
