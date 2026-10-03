package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Session struct {
	ent.Schema
}

func (Session) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Session) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("user_agent").Default("").MaxLen(255),
		field.String("ip_address").Default("").MaxLen(64),
		field.String("device_hash").Optional().Nillable().MaxLen(64),
		field.Time("last_used_at"),
		field.Time("expires_at"),
		field.Time("revoked_at").Optional().Nillable(),
		field.Enum("revoked_reason").Values("logout", "refresh_token_reuse", "revoke_all", "password_changed").Optional().Nillable(),
	}
}

func (Session) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("account", Account.Type).Ref("sessions").Field("account_id").Unique().Required().Immutable(),
		edge.To("refresh_tokens", RefreshToken.Type),
	}
}

func (Session) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "revoked_at")}
}
