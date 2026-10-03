package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CopyrightClaim struct {
	ent.Schema
}

func (CopyrightClaim) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CopyrightClaim) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("claimant_user_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("claimant_name").MaxLen(120).Default("").Immutable(),
		field.String("claimant_organization").MaxLen(160).Default("").Immutable(),
		field.String("claimant_email").MaxLen(254).Immutable(),
		field.String("represents").MaxLen(160).Default("").Immutable(),
		field.String("work_title").MaxLen(1000).Immutable(),
		field.Enum("work_type").Values("sound", "video", "image", "text").Default("video").Immutable(),
		field.Enum("target_type").Values("clip", "sound", "post", "live").Immutable(),
		field.String("target_id").MaxLen(128).Immutable(),
		field.UUID("infringer_id", uuid.UUID{}).Optional().Nillable(),
		field.Enum("target_flag").Values("visible", "limited", "taken_down").Default("visible"),
		field.Enum("status").Values("pending", "needs_info", "upheld", "rejected", "counter_notice", "restored").Default("pending"),
		field.String("rights_basis").MaxLen(1000).Immutable(),
		field.String("sworn_statement").MaxLen(1000).Immutable(),
		field.Strings("claimed_urls").Default([]string{}).Immutable(),
		field.Bytes("target_preview").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("audio_matches").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Int("top_audio_match_percent").Optional().Nillable(),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.UUID("strike_id", uuid.UUID{}).Optional().Nillable(),
		field.String("idempotency_key").MaxLen(128).Optional().Nillable().Immutable(),
	}
}

func (CopyrightClaim) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("claimant_user_id", "idempotency_key").Unique(),
		index.Fields("status", "created_at"),
		index.Fields("infringer_id"),
		index.Fields("target_type", "target_id"),
	}
}
