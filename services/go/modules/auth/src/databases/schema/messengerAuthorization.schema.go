package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type MessengerAuthorization struct {
	ent.Schema
}

func (MessengerAuthorization) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (MessengerAuthorization) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("proof_hash").NotEmpty().Immutable().Sensitive(),
		field.String("installation_hash").NotEmpty().Immutable().Sensitive().MaxLen(64),
		field.Enum("platform").Values("android", "ios", "other").Immutable(),
		field.String("device_name").NotEmpty().MaxLen(120).Immutable(),
		field.String("user_agent").Default("").MaxLen(255).Immutable(),
		field.String("ip_address").Default("").MaxLen(64).Immutable(),
		field.Enum("status").Values("pending", "approved", "denied", "completed").Default("pending"),
		field.String("approval_method").Optional().Nillable().MaxLen(24),
		field.UUID("approved_by_session_id", uuid.UUID{}).Optional().Nillable(),
		field.String("code_hash").Optional().Nillable().Sensitive().MaxLen(64),
		field.Time("code_expires_at").Optional().Nillable(),
		field.Time("code_issued_at").Optional().Nillable(),
		field.Int("code_attempts").Default(0).NonNegative(),
		field.Time("expires_at").Immutable(),
		field.Time("completed_at").Optional().Nillable(),
		field.UUID("completed_session_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (MessengerAuthorization) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("account", Account.Type).Ref("messenger_authorizations").Field("account_id").Unique().Required().Immutable(),
	}
}

func (MessengerAuthorization) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("proof_hash").Unique(),
		index.Fields("account_id", "created_at"),
		index.Fields("account_id", "status", "expires_at"),
	}
}
