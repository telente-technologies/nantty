package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffSession struct {
	ent.Schema
}

func (StaffSession) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffSession) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("staff_id", uuid.UUID{}).Immutable(),
		field.String("ip_address").Default("").MaxLen(64),
		field.String("user_agent").Default("").MaxLen(255),
		field.String("refresh_hash").NotEmpty().Sensitive(),
		field.String("previous_refresh_hash").Optional().Nillable().Sensitive(),
		field.Time("last_used_at"),
		field.Time("expires_at"),
		field.Time("revoked_at").Optional().Nillable(),
		field.Bytes("webauthn_session").Optional().Sensitive(),
		field.Enum("webauthn_ceremony").Values("register", "step_up").Optional().Nillable(),
		field.Time("webauthn_expires_at").Optional().Nillable(),
	}
}

func (StaffSession) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("staff", StaffAccount.Type).Ref("sessions").Field("staff_id").Unique().Required().Immutable(),
	}
}

func (StaffSession) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("refresh_hash").Unique(),
		index.Fields("previous_refresh_hash"),
		index.Fields("staff_id", "revoked_at"),
	}
}
