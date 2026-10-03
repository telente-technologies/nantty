package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ProfileCheckmark struct {
	ent.Schema
}

func (ProfileCheckmark) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProfileCheckmark) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("color").Values("blue", "gold", "black"),
		field.Enum("status").Values("verified", "suspended", "revoked", "grace", "expired").Default("verified"),
		field.Enum("source").Values("application", "lifetime_grant", "business_documents", "black_vetting", "subscription"),
		field.UUID("source_id", uuid.UUID{}).Optional().Nillable(),
		field.Time("current_period_end").Optional().Nillable(),
		field.Time("reverification_due_at").Optional().Nillable(),
		field.Time("grace_ends_at").Optional().Nillable(),
		field.Bool("handle_reserved").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProfileCheckmark) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id").Unique(), index.Fields("account_id"), index.Fields("status", "reverification_due_at")}
}
