package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PaymentIntent struct {
	ent.Schema
}

func (PaymentIntent) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"payment_intents_amount_positive":           "amount_minor > 0",
		"payment_intents_refunds_within_amount":     "refunded_minor >= 0 AND refunded_minor <= amount_minor",
		"payment_intents_refund_capacity":           "refund_in_flight_minor >= 0 AND refunded_minor + refund_in_flight_minor <= amount_minor",
		"payment_intents_provider_fee_not_negative": "provider_fee_minor >= 0",
		"payment_intents_platform_fee_in_range":     "platform_fee_minor >= 0 AND platform_fee_minor < amount_minor",
	})}
}

func (PaymentIntent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PaymentIntent) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("purpose").Values("order_checkout", "coin_purchase", "wallet_top_up", "creator_subscription", "ad_balance_top_up", "card_verification", "subscription_renewal").Immutable(),
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("subject_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("connected_account_id").MaxLen(80).Default("").Immutable(),
		field.String("beneficiary_user_id").MaxLen(80).Default("").Immutable(),
		field.Int64("platform_fee_minor").Default(0).Immutable(),
		field.String("provider_checkout_id").MaxLen(120).Default(""),
		field.Enum("status").Values("pending", "succeeded", "failed", "cancelled").Default("pending"),
		field.String("authorization_url").MaxLen(2000).Default(""),
		field.String("provider_transaction_id").MaxLen(120).Default(""),
		field.Int64("provider_fee_minor").Default(0),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("paid_at").Optional().Nillable(),
		field.Time("failed_at").Optional().Nillable(),
		field.Int64("refunded_minor").Default(0),
		field.Int64("refund_in_flight_minor").Default(0),
		field.Time("saved_card_charge_started_at").Optional().Nillable(),
		field.String("customer_email").MaxLen(320).Default(""),
		field.Time("provider_settled_at").Optional().Nillable(),
		field.Int64("version").Default(0),
		field.Bytes("metadata").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PaymentIntent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("purpose", "subject_id"),
		index.Fields("owner_user_id", "created_at"),
		index.Fields("status", "created_at"),
		index.Fields("provider_checkout_id"),
		index.Fields("provider_transaction_id"),
		index.Fields("provider", "provider_transaction_id").Unique().Annotations(entsql.IndexWhere("provider_transaction_id <> ''")).StorageKey("payment_intents_provider_charge_unique"),
		index.Fields("purpose", "subject_id").Unique().
			Annotations(entsql.IndexWhere("status = 'succeeded' AND failure_reason NOT LIKE 'duplicate%'")).StorageKey("payment_intents_one_settlement_per_subject"),
	}
}
