package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffAccount struct {
	ent.Schema
}

func (StaffAccount) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffAccount) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").NotEmpty().MaxLen(254),
		field.String("display_name").Default("").MaxLen(80),
		field.Enum("role").Values("superadmin", "admin", "support"),
		field.Strings("role_ids").Default([]string{}),
		field.Strings("permissions").Default([]string{}),
		field.String("password_hash").Optional().Nillable().Sensitive(),
		field.Enum("status").Values("invited", "active", "disabled", "suspended", "revoked", "pending_approval").Default("invited"),
		field.Bytes("totp_secret_encrypted").Optional().Sensitive(),
		field.Time("totp_confirmed_at").Optional().Nillable(),
		field.Int64("totp_last_used_step").Default(0),
		field.Int("failed_attempts").Default(0).NonNegative(),
		field.Time("locked_until").Optional().Nillable(),
		field.Strings("recovery_code_hashes").Default([]string{}).Sensitive(),
		field.Strings("ip_allow_list").Default([]string{}),
		field.Enum("theme_preference").Values("light", "dark", "system").Default("system"),
		field.UUID("created_by", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("approved_by", uuid.UUID{}).Optional().Nillable(),
		field.Time("approved_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StaffAccount) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("sessions", StaffSession.Type),
		edge.To("challenges", StaffLoginChallenge.Type),
		edge.To("invitations", StaffInvitation.Type),
		edge.To("passkeys", StaffWebauthnCredential.Type),
		edge.To("consents", StaffConsent.Type),
	}
}

func (StaffAccount) Indexes() []ent.Index {
	return []ent.Index{index.Fields("email").Unique()}
}
