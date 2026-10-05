package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"zudomart/modules/subscriptions/src/models"
)

type CreatorSubscriptionPlan struct {
	ent.Schema
}

func (CreatorSubscriptionPlan) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorSubscriptionPlan) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("description").MaxLen(1000).Default(""),
		field.Int64("amount_minor").Positive().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("interval").Values("month", "year").Default("month").Immutable(),
		field.JSON("benefits", []models.CreatorPlanBenefit{}).Default([]models.CreatorPlanBenefit{}),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CreatorSubscriptionPlan) Indexes() []ent.Index {
	return []ent.Index{index.Fields("creator_id", "created_at")}
}

type CreatorSubscription struct {
	ent.Schema
}

func (CreatorSubscription) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorSubscription) Fields() []ent.Field {
	return []ent.Field{
		field.String("subscriber_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("plan_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("status").Values("pending", "active", "past_due", "cancelled", "expired", "failed").Default("pending"),
		field.Int64("amount_minor").Positive().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("interval").Values("month", "year").Immutable(),
		field.String("billing_authorization_id").MaxLen(80).Default(""),
		field.Time("current_period_start").Optional().Nillable(),
		field.Time("current_period_end").Optional().Nillable(),
		field.Time("next_charge_at").Optional().Nillable(),
		field.Int("renewal_attempts").Default(0),
		field.String("last_error").MaxLen(300).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CreatorSubscription) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("subscriber_id", "creator_id"),
		index.Fields("creator_id", "status"),
		index.Fields("status", "current_period_end"),
		index.Fields("next_charge_at").Annotations(entsql.IndexWhere("next_charge_at IS NOT NULL")).StorageKey("creator_subscriptions_next_charge_due"),
	}
}

type CreatorSubscriptionCharge struct {
	ent.Schema
}

func (CreatorSubscriptionCharge) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorSubscriptionCharge) Fields() []ent.Field {
	return []ent.Field{
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("subscriber_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("kind").Values("initial", "renewal").Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(160).Immutable(),
		field.String("payment_reference").MaxLen(80).Default(""),
		field.Int("attempt_count").Default(0),
		field.Int64("amount_minor").Positive().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("status").Values("pending", "succeeded", "failed").Default("pending"),
		field.Int64("provider_fee_minor").Default(0),
		field.Int64("creator_share_minor").Default(0),
		field.Int64("platform_share_minor").Default(0),
		field.Time("period_start").Optional().Nillable(),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("paid_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CreatorSubscriptionCharge) Indexes() []ent.Index {
	return []ent.Index{index.Fields("idempotency_key").Unique(), index.Fields("payment_reference"), index.Fields("subscription_id", "created_at")}
}
