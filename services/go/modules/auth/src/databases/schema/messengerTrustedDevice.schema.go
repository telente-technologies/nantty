package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type MessengerTrustedDevice struct {
	ent.Schema
}

func (MessengerTrustedDevice) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (MessengerTrustedDevice) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("token_hash").NotEmpty().Sensitive().MaxLen(64),
		field.String("installation_hash").NotEmpty().Immutable().Sensitive().MaxLen(64),
		field.Enum("platform").Values("android", "ios", "other").Immutable(),
		field.String("device_name").NotEmpty().MaxLen(120),
		field.String("user_agent").Default("").MaxLen(255),
		field.Time("last_used_at"),
		field.Time("expires_at"),
		field.Time("revoked_at").Optional().Nillable(),
	}
}

func (MessengerTrustedDevice) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("account", Account.Type).Ref("messenger_trusted_devices").Field("account_id").Unique().Required().Immutable(),
	}
}

func (MessengerTrustedDevice) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
		index.Fields("account_id", "revoked_at"),
		index.Fields("account_id", "installation_hash", "revoked_at"),
	}
}
