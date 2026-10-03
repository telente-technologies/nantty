package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"zudomart/modules/ads/src/types"
)

var deliveryStatuses = []string{"draft", "in_review", "active", "paused", "completed", "rejected"}

type AdCampaign struct{ ent.Schema }

func (AdCampaign) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdCampaign) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.Enum("objective").Values("awareness", "traffic", "engagement", "messages", "sales", "followers", "store_promotion").Immutable(),
		field.Enum("kind").Values("standard", "boost").Default("standard").Immutable(),
		field.Enum("status").Values(deliveryStatuses...).Default("draft"),
		field.Enum("budget_level").Values("campaign", "ad_set"),
		field.Enum("budget_type").Values("daily", "lifetime").Optional().Nillable(),
		field.Int64("budget_amount_minor").Optional().Nillable(),
		field.Int64("spend_cap_minor").Optional().Nillable(),
		field.Time("start_at"),
		field.Time("end_at").Optional().Nillable(),
		field.UUID("created_by_user_id", uuid.UUID{}).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdCampaign) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "status", "created_at"), index.Fields("status", "start_at")}
}

type AdGroup struct{ ent.Schema }

func (AdGroup) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdGroup) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.Enum("status").Values(deliveryStatuses...).Default("draft"),
		field.JSON("audience", types.AudienceSpec{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("placement_mode").Values("automatic", "manual").Default("automatic"),
		field.JSON("placements", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("start_at"),
		field.Time("end_at").Optional().Nillable(),
		field.Enum("budget_type").Values("daily", "lifetime").Optional().Nillable(),
		field.Int64("budget_amount_minor").Optional().Nillable(),
		field.Enum("bid_type").Values("auto", "max_cpc", "max_cpm", "target_cost").Default("auto"),
		field.Int64("bid_amount_minor").Optional().Nillable(),
		field.Int("frequency_cap_impressions").Optional().Nillable(),
		field.Int("frequency_cap_per_days").Optional().Nillable(),
		field.String("conversion_event_id").MaxLen(80).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdGroup) Indexes() []ent.Index {
	return []ent.Index{index.Fields("campaign_id"), index.Fields("account_id", "status"), index.Fields("status", "start_at")}
}

type Ad struct{ ent.Schema }

func (Ad) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (Ad) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_group_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.Enum("status").Values(deliveryStatuses...).Default("draft"),
		field.Enum("review_status").Values("not_submitted", "pending", "approved", "rejected").Default("not_submitted"),
		field.String("policy_code").MaxLen(60).Default(""),
		field.String("policy_reason").MaxLen(600).Default(""),
		field.Time("submitted_at").Optional().Nillable(),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("reviewed_by_name").MaxLen(120).Default(""),
		field.Enum("appeal_status").Values("pending", "upheld", "overturned").Optional().Nillable(),
		field.String("appeal_message").MaxLen(1000).Default(""),
		field.Time("appeal_submitted_at").Optional().Nillable(),
		field.Time("appeal_resolved_at").Optional().Nillable(),
		field.String("appeal_resolution_note").MaxLen(600).Default(""),
		field.String("format").MaxLen(20),
		field.JSON("creative", types.StoredCreative{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.JSON("auto_check_flags", []types.AutoCheckFlag{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Default(func() []types.AutoCheckFlag { return []types.AutoCheckFlag{} }),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Ad) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("ad_group_id"), index.Fields("campaign_id"), index.Fields("account_id", "status"),
		index.Fields("review_status", "submitted_at"),
	}
}
