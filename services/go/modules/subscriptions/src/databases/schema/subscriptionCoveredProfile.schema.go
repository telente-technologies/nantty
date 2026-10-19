package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SubscriptionCoveredProfile struct {
	ent.Schema
}

func (SubscriptionCoveredProfile) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionCoveredProfile) Fields() []ent.Field {
	return []ent.Field{
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("profile_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("status").Values("pending", "active", "removing", "removed", "rejected", "released").Default("pending"),
		field.String("activates_with_period_id").MaxLen(80).Default(""),
		field.Int64("share_minor").Default(0),
		field.String("share_payment_reference").MaxLen(120).Default(""),
		field.String("refund_state").MaxLen(40).Default(""),
		field.Time("activated_at").Optional().Nillable(),
		field.Time("ended_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SubscriptionCoveredProfile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("profile_id").Unique().Annotations(entsql.IndexWhere("status IN ('pending','active','removing')")).StorageKey("subscription_covered_profiles_live_per_profile"),
		index.Fields("subscription_id", "status"),
	}
}
