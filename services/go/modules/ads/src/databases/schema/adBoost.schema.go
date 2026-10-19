package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdBoost struct{ ent.Schema }

func (AdBoost) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdBoost) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.String("post_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("destination_type").Values("post", "profile", "store", "product").Default("post").Immutable(),
		field.Enum("goal").Values("views", "profile_visits", "messages", "store_visits", "product_visits").Immutable(),
		field.Enum("status").Values("pending_payment", "in_review", "active", "paused", "completed", "rejected", "cancelled").Default("pending_payment"),
		field.Bytes("audience").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Enum("budget_type").Values("daily", "total").Default("daily").Immutable(),
		field.Int64("daily_budget_minor"),
		field.Int("duration_days"),
		field.Int64("total_budget_minor"),
		field.Int64("added_budget_minor").Default(0),
		field.Enum("payment_method").Values("wallet", "card", "balance", "free", "ad_balance").Immutable(),
		field.String("payment_top_up_id").MaxLen(80).Default(""),
		field.String("idempotency_key").MaxLen(128).Immutable(),
		field.String("request_hash").MaxLen(64).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_group_id", uuid.UUID{}).Immutable(),
		field.UUID("ad_id", uuid.UUID{}).Immutable(),
		field.Time("scheduled_start_at").Optional().Nillable(),
		field.Time("starts_at").Optional().Nillable(),
		field.Time("ends_at").Optional().Nillable(),
		field.String("rejection_reason").MaxLen(600).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdBoost) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "idempotency_key").Unique(),
		index.Fields("user_id", "created_at"),
		index.Fields("campaign_id"),
		index.Fields("status", "ends_at"),
		index.Fields("payment_top_up_id"),
		index.Fields("destination_type", "post_id"),
	}
}

type AdFreeBoostGrant struct{ ent.Schema }

func (AdFreeBoostGrant) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdFreeBoostGrant) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.String("period_key").MinLen(7).MaxLen(7).Immutable(),
		field.UUID("boost_id", uuid.UUID{}).Immutable(),
		field.Int64("value_minor").Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
	}
}

func (AdFreeBoostGrant) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "period_key").Unique(), index.Fields("boost_id").Unique()}
}

type AdBoostChange struct{ ent.Schema }

func (AdBoostChange) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdBoostChange) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("boost_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").MaxLen(128).Immutable(),
		field.String("request_hash").MaxLen(64).Immutable(),
		field.Int("extra_days").Immutable(),
		field.Int64("new_daily_budget_minor").Immutable(),
		field.Int64("additional_minor").Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Enum("payment_method").Values("card", "ad_balance").Immutable(),
		field.Enum("status").Values("pending_payment", "applied", "unapplied").Default("pending_payment"),
		field.String("payment_top_up_id").MaxLen(80).Default(""),
		field.Time("applied_at").Optional().Nillable(),
	}
}

func (AdBoostChange) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "idempotency_key").Unique(), index.Fields("boost_id"), index.Fields("payment_top_up_id")}
}
