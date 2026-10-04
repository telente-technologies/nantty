package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Strike struct {
	ent.Schema
}

func (Strike) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Strike) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("kind").Values("warning", "strike").Default("strike").Immutable(),
		field.String("policy").MaxLen(120).Immutable(),
		field.String("reason").MaxLen(1000).Immutable(),
		field.Enum("source").Values("moderation", "copyright", "manual", "ip_claim").Immutable(),
		field.String("issued_by_id").MaxLen(64).Default("").Immutable(),
		field.String("issued_by_name").MaxLen(120).Default("System").Immutable(),
		field.String("reference_type").MaxLen(40).Default("").Immutable(),
		field.String("reference_id").MaxLen(128).Default("").Immutable(),
		field.String("reference_key").MaxLen(220).Optional().Nillable().Immutable(),
		field.Time("expires_at").Optional().Nillable(),
		field.Time("revoked_at").Optional().Nillable(),
		field.String("revoked_reason").MaxLen(500).Default(""),
		field.Enum("appeal_status").Values("none", "pending", "upheld", "overturned").Default("none"),
		field.String("appeal_message").MaxLen(2000).Default(""),
		field.Time("appealed_at").Optional().Nillable(),
		field.Time("expiry_announced_at").Optional().Nillable(),
	}
}

func (Strike) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "reference_key").Unique(),
		index.Fields("account_id", "revoked_at", "expires_at"),
		index.Fields("reference_type", "reference_id"),
		index.Fields("expiry_announced_at", "expires_at"),
		index.Fields("appeal_status", "appealed_at"),
	}
}
