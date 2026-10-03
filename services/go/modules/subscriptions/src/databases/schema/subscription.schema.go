package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Subscription struct {
	ent.Schema
}

func (Subscription) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Subscription) Fields() []ent.Field {
	return []ent.Field{
		field.String("profile_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("profile_type").NotEmpty().MaxLen(20).Immutable(),
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("plan_code").NotEmpty().MaxLen(40).Immutable(),
		field.Enum("interval").Values("month", "year").Immutable(),
		field.Enum("channel").Values("web_paystack", "apple_iap", "google_play", "admin_grant").Immutable(),
		field.Enum("status").Values("pending", "awaiting_card", "trialing", "active", "past_due", "grace", "canceled", "downgraded", "expired", "trial_rejected").Default("pending"),
		field.Int64("list_amount_minor"),
		field.Int64("amount_minor"),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Enum("discount_kind").Values("none", "yearly", "bundle").Default("none"),
		field.Int64("discount_bps").Default(0),
		field.Bool("with_trial").Default(false).Immutable(),
		field.Int("trial_days").Default(0),
		field.Time("trial_ends_at").Optional().Nillable(),
		field.Time("current_period_ends_at").Optional().Nillable(),
		field.Time("grace_ends_at").Optional().Nillable(),
		field.Time("bundle_lapses_at").Optional().Nillable(),
		field.Bool("cancel_at_period_end").Default(false),
		field.String("provider_plan_code").MaxLen(60).Default(""),
		field.String("provider_customer_id").MaxLen(120).Default(""),
		field.String("billing_reference").MaxLen(120).Default(""),
		field.String("store_original_transaction_id").MaxLen(200).Default(""),
		field.String("card_label").MaxLen(60).Default(""),
		field.Bool("activation_pending").Default(false),
		field.String("last_error").MaxLen(300).Default(""),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Subscription) Indexes() []ent.Index {
	live := "status IN ('pending','awaiting_card','trialing','active','past_due','grace')"
	return []ent.Index{
		index.Fields("profile_id", "plan_code").Unique().Annotations(entsql.IndexWhere(live)).StorageKey("subscriptions_live_per_profile"),
		index.Fields("owner_user_id", "status"),
		index.Fields("billing_reference"),
		index.Fields("store_original_transaction_id"),
		index.Fields("status", "trial_ends_at"),
		index.Fields("activation_pending").Annotations(entsql.IndexWhere("activation_pending")).StorageKey("subscriptions_activation_pending"),
	}
}

type PlanPrice struct {
	ent.Schema
}

func (PlanPrice) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PlanPrice) Fields() []ent.Field {
	return []ent.Field{
		field.String("plan_code").NotEmpty().MaxLen(40),
		field.String("country_code").NotEmpty().MaxLen(2),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Int64("monthly_amount_minor"),
		field.Bool("active").Default(true),
		field.String("updated_by_staff_id").MaxLen(80).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PlanPrice) Indexes() []ent.Index {
	return []ent.Index{index.Fields("plan_code", "country_code").Unique()}
}

type ProviderPlan struct {
	ent.Schema
}

func (ProviderPlan) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderPlan) Fields() []ent.Field {
	return []ent.Field{
		field.String("plan_code").NotEmpty().MaxLen(40).Immutable(),
		field.String("interval").NotEmpty().MaxLen(10).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("provider_plan_code").NotEmpty().MaxLen(60).Immutable(),
	}
}

func (ProviderPlan) Indexes() []ent.Index {
	return []ent.Index{index.Fields("plan_code", "interval", "amount_minor", "currency").Unique()}
}

type TrialClaim struct {
	ent.Schema
}

func (TrialClaim) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (TrialClaim) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("kind").Values("person", "card", "device", "phone").Immutable(),
		field.String("fingerprint_hash").NotEmpty().MaxLen(80).Immutable(),
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
	}
}

func (TrialClaim) Indexes() []ent.Index {
	return []ent.Index{index.Fields("kind", "fingerprint_hash").Unique()}
}

type SubscriptionReminder struct {
	ent.Schema
}

func (SubscriptionReminder) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionReminder) Fields() []ent.Field {
	return []ent.Field{
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("kind").NotEmpty().MaxLen(40).Immutable(),
		field.Int("days_before").Immutable(),
		field.Time("due_at").Immutable(),
		field.Time("sent_at").Optional().Nillable(),
	}
}

func (SubscriptionReminder) Indexes() []ent.Index {
	return []ent.Index{index.Fields("subscription_id", "kind", "days_before").Unique(), index.Fields("due_at").Annotations(entsql.IndexWhere("sent_at IS NULL")).StorageKey("subscription_reminders_due")}
}
