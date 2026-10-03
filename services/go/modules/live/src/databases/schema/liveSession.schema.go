package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
	"time"
)

type LiveSession struct {
	ent.Schema
}

func (LiveSession) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveSession) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("host_id", uuid.UUID{}).Immutable(),
		field.String("title").NotEmpty().MaxLen(140),
		field.Enum("category").Values("justChatting", "gaming", "music", "irl", "education", "shopping").Default("justChatting"),
		field.Enum("visibility").Values("public", "followers", "subscribers").Default("public"),
		field.Enum("state").Values("idle", "connecting", "live", "ended").Default("idle"),
		field.Time("started_at").Optional().Nillable(),
		field.Time("ended_at").Optional().Nillable(),
		field.Int("viewers").Default(0),
		field.Int("peak_viewers").Default(0),
		field.String("cover_url").Optional().Nillable(),
		field.Bool("gifts_enabled").Default(true),
		field.Bool("host_is_creator").Default(false),
		field.UUID("store_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("pinned_product_id", uuid.UUID{}).Optional().Nillable(),
		field.String("livekit_room").NotEmpty().Immutable(),
		field.String("country_code").Default("").MaxLen(2),
		field.UUID("top_supporter_user_id", uuid.UUID{}).Optional().Nillable(),
		field.Int64("gift_count").Default(0),
		field.Int64("total_coins").Default(0),
		field.Int64("creator_coins").Default(0),
		field.JSON("live_ad_settings", map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("accepted_live_ad_terms_version").Optional().Nillable(),
		field.Time("accepted_live_ad_terms_at").Optional().Nillable(),
		field.String("sponsorship_line").Optional().Nillable().MaxLen(200),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LiveSession) Indexes() []ent.Index {
	return []ent.Index{index.Fields("state", "created_at"), index.Fields("host_id", "state")}
}
