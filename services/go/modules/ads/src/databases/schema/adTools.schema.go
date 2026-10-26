package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"

	"nantty/modules/ads/src/types"
)

type AdConversionEvent struct{ ent.Schema }

func (AdConversionEvent) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdConversionEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.Enum("event_type").Values("purchase", "add_to_cart", "checkout_started", "message_started", "profile_follow", "store_visit").Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_name").MaxLen(120).Default(""),
		field.Bool("is_built_in").Default(false).Immutable(),
		field.Enum("status").Values("active", "paused").Default("active"),
		field.Bool("tracks_value").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdConversionEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "created_at"),
		index.Fields("account_id", "store_id", "event_type").Unique().Annotations(entsql.IndexWhere("is_built_in")).StorageKey("ad_conversion_events_built_in"),
	}
}

type AdExperiment struct{ ent.Schema }

func (AdExperiment) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdExperiment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(100),
		field.Enum("variable").Values("audience", "creative", "placement", "bid_strategy").Immutable(),
		field.Enum("metric").Values("cost_per_result", "ctr", "roas", "conversions").Immutable(),
		field.Enum("status").Values("draft", "running", "completed", "stopped").Default("draft"),
		field.JSON("arms", []types.ExperimentArm{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.Time("start_at").Immutable(),
		field.Time("end_at"),
		field.JSON("result", &types.ExperimentResult{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Optional(),
		field.UUID("created_by_user_id", uuid.UUID{}).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdExperiment) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at"), index.Fields("status", "end_at")}
}

type AdAutomatedRule struct{ ent.Schema }

func (AdAutomatedRule) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdAutomatedRule) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(100),
		field.Enum("status").Values("active", "paused").Default("active"),
		field.Enum("level").Values("campaign", "ad_set", "ad"),
		field.JSON("target_ids", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.JSON("conditions", []types.RuleCondition{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("action_type").Values("pause", "notify", "increase_budget", "decrease_budget"),
		field.Int("action_percent").Optional().Nillable(),
		field.Int("check_every_minutes").Default(60),
		field.Time("last_run_at").Optional().Nillable(),
		field.Time("last_triggered_at").Optional().Nillable(),
		field.Int("trigger_count").Default(0),
		field.Time("next_run_at"),
		field.UUID("created_by_user_id", uuid.UUID{}).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdAutomatedRule) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at"), index.Fields("status", "next_run_at")}
}

type AdTopUp struct{ ent.Schema }

func (AdTopUp) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdTopUp) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("money_top_up_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("reference").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.String("provider").MaxLen(20).Default("flutterwave").Immutable(),
		field.Enum("status").Values("pending", "succeeded", "failed", "abandoned").Default("pending"),
		field.String("failure_reason").MaxLen(200).Default(""),
		field.String("authorization_url").MaxLen(600).Default(""),
		field.UUID("requested_by_user_id", uuid.UUID{}).Immutable(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdTopUp) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("money_top_up_id").Unique(), index.Fields("account_id", "created_at")}
}
