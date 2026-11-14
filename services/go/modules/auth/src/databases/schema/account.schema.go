package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Account struct {
	ent.Schema
}

func (Account) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Account) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").Optional().Nillable().MaxLen(254),
		field.String("username").NotEmpty().MaxLen(30),
		field.String("password_hash").Optional().Nillable().Sensitive(),
		field.String("name").Default("").MaxLen(80),
		field.Time("birthday").Optional().Nillable().SchemaType(map[string]string{"postgres": "date"}),
		field.Strings("roles").Default([]string{"buyer"}),
		field.Time("email_verified_at").Optional().Nillable(),
		field.Enum("status").Values("active", "deactivated", "suspended", "banned", "deleted").Default("active"),
		field.Bool("must_change_password").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Account) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("sessions", Session.Type),
		edge.To("social_identities", SocialIdentity.Type),
		edge.To("messenger_authorizations", MessengerAuthorization.Type),
		edge.To("messenger_trusted_devices", MessengerTrustedDevice.Type),
	}
}

func (Account) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("email").Unique(),
		index.Fields("username").Unique(),
	}
}
