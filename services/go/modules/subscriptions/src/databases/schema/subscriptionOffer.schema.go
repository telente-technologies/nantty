package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SubscriptionOfferLink struct {
	ent.Schema
}

func (SubscriptionOfferLink) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionOfferLink) Fields() []ent.Field {
	return []ent.Field{
		field.String("token_hash").NotEmpty().MaxLen(64).Immutable().Sensitive(),
		field.String("token_salt").NotEmpty().MaxLen(64).Immutable().Sensitive(),
		field.String("label").MaxLen(120).Default(""),
		field.JSON("plan_codes", []string{}),
		field.Enum("discount_kind").Values("percentage", "fixed_amount").Immutable(),
		field.Int64("percent_off").Default(0).Immutable(),
		field.Int64("amount_off_minor").Default(0).Immutable(),
		field.String("amount_off_currency").MaxLen(3).Default("").Immutable(),
		field.Bool("single_use").Immutable(),
		field.Int("max_claims").Positive().Immutable(),
		field.Int("claimed_count").NonNegative().Default(0),
		field.Int("redeemed_count").NonNegative().Default(0),
		field.Int("duration_cycles").Positive().Immutable(),
		field.Time("expires_at").Optional().Nillable(),
		field.Time("revoked_at").Optional().Nillable(),
		field.String("revoked_by_staff_id").MaxLen(80).Default(""),
		field.String("created_by_staff_id").NotEmpty().MaxLen(80).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SubscriptionOfferLink) Indexes() []ent.Index {
	return []ent.Index{index.Fields("token_hash").Unique(), index.Fields("created_at")}
}

type SubscriptionOfferClaim struct {
	ent.Schema
}

func (SubscriptionOfferClaim) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionOfferClaim) Fields() []ent.Field {
	return []ent.Field{
		field.String("link_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("profile_id").NotEmpty().MaxLen(80),
		field.Enum("status").Values("reserved", "redeemed", "released").Default("reserved"),
		field.String("subscription_id").MaxLen(80).Default(""),
		field.Time("reserved_until"),
		field.Time("redeemed_at").Optional().Nillable(),
		field.Time("released_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SubscriptionOfferClaim) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("link_id", "owner_user_id").Unique().Annotations(entsql.IndexWhere("status IN ('reserved','redeemed')")).StorageKey("subscription_offer_claims_one_per_account"),
		index.Fields("status", "reserved_until"),
		index.Fields("link_id", "created_at"),
	}
}

type SubscriptionOfferSend struct {
	ent.Schema
}

func (SubscriptionOfferSend) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionOfferSend) Fields() []ent.Field {
	return []ent.Field{
		field.String("link_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("recipient_email").NotEmpty().MaxLen(254).Immutable(),
		field.String("note").MaxLen(2000).Default("").Immutable(),
		field.String("sent_by_staff_id").NotEmpty().MaxLen(80).Immutable(),
	}
}

func (SubscriptionOfferSend) Indexes() []ent.Index {
	return []ent.Index{index.Fields("link_id", "created_at")}
}
