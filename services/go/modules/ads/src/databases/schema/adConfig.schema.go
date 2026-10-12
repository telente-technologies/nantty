package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdFrequencyPolicy struct{ ent.Schema }

func (AdFrequencyPolicy) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdFrequencyPolicy) Fields() []ent.Field {
	return []ent.Field{
		field.String("format").MaxLen(20).Immutable(),
		field.Int("session_cap"),
		field.Int("hour_cap"),
		field.Int("day_cap"),
		field.Int("advertiser_day_cap"),
		field.Int("min_gap_slots"),
		field.Int("cooldown_seconds_after_skip"),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdFrequencyPolicy) Indexes() []ent.Index { return []ent.Index{index.Fields("format").Unique()} }

type AdContentSignal struct{ ent.Schema }

func (AdContentSignal) Fields() []ent.Field {
	return []ent.Field{
		field.String("content_id").MaxLen(80).Immutable().Unique(),
		field.String("creator_user_id").MaxLen(80).Default(""),
		field.String("content_kind").MaxLen(20),
		field.Int("duration_seconds").Default(0),
		field.Bool("brand_safe").Default(true),
		field.Bool("sensitive").Default(false),
		field.Bool("kids_content").Default(false),
		field.Bool("ai_generated").Default(false),
		field.Bool("monetization_eligible").Default(false),
		field.Bool("removed").Default(false),
		field.JSON("opted_in_placements", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.JSON("topics", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

type AdPolicyCategory struct{ ent.Schema }

func (AdPolicyCategory) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdPolicyCategory) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").MaxLen(60),
		field.String("name").MaxLen(60),
		field.String("description").MaxLen(400),
		field.Enum("severity").Values("LOW", "MEDIUM", "HIGH", "CRITICAL"),
		field.Bool("is_active").Default(true),
		field.Int("rejection_count").Default(0),
		field.UUID("created_by", uuid.UUID{}).Optional().Nillable(),
	}
}

func (AdPolicyCategory) Indexes() []ent.Index {
	return []ent.Index{index.Fields("code").Unique(), index.Fields("name").Unique()}
}
