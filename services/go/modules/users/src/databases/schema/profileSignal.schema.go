package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ProfileSignal struct {
	ent.Schema
}

func (ProfileSignal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Int("real_followers").Default(0).NonNegative(),
		field.Int("creator_real_followers").Default(0).NonNegative(),
		field.Int("creator_original_posts_last_60_days").Default(0).NonNegative(),
		field.Int("verified_followers").Default(0).NonNegative(),
		field.Int("qualifying_impressions_last_30_days").Default(0).NonNegative(),
		field.String("creator_metrics_source").Default("").MaxLen(48),
		field.Time("creator_metrics_as_of").Optional().Nillable(),
		field.UUID("creator_metrics_snapshot_id", uuid.UUID{}).Optional().Nillable(),
		field.Int("original_posts_last_60_days").Default(0).NonNegative(),
		field.Int("days_since_last_violation").Default(100000).NonNegative(),
		field.Int("creator_days_since_last_violation").Default(0).NonNegative(),
		field.Bool("creator_standing_available").Default(false),
		field.String("creator_standing_source").Default("").MaxLen(48),
		field.Time("creator_standing_as_of").Optional().Nillable(),
		field.UUID("creator_standing_snapshot_id", uuid.UUID{}).Optional().Nillable(),
		field.Int("fraud_score").Default(0).Min(0).Max(100),
		field.Int("risk_score").Default(0).Min(0).Max(100),
		field.Bool("id_verified").Default(false),
		field.Bool("borderline_content").Default(false),
		field.Int("completed_orders").Default(0).NonNegative(),
		field.Int("success_rate_percent").Default(0).Min(0).Max(100),
		field.Bool("has_active_store_or_brand_page").Default(false),
		field.Enum("seller_plan").Values("FREE", "PRO", "BUSINESS").Default("FREE"),
		field.Time("checkmark_suggested_at").Optional().Nillable(),
		field.Time("premium_until").Optional().Nillable(),
		field.Time("seller_plan_until").Optional().Nillable(),
		field.Bool("seller_plan_trialing").Default(false),
		field.String("source").Default("").MaxLen(40),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProfileSignal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id").Unique(), index.Fields("account_id")}
}
