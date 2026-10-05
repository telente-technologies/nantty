package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CoinPackage struct {
	ent.Schema
}

func (CoinPackage) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"coin_packages_coins_positive": "coins > 0 AND bonus_coins >= 0"})}
}

func (CoinPackage) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(60).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.Int64("coins"),
		field.Int64("bonus_coins").Default(0),
		field.Enum("purchase_channel").Values("web_checkout", "store_iap"),
		field.Enum("client_platform").Values("web", "ios", "android").Default("web"),
		field.Bytes("prices").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("store_product_id").MaxLen(200).Default(""),
		field.Bool("active").Default(true),
		field.Int("sort_order").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CoinPackage) Indexes() []ent.Index {
	return []ent.Index{index.Fields("purchase_channel", "active", "sort_order"), index.Fields("client_platform", "active", "sort_order"), index.Fields("store_product_id")}
}

type CoinPurchase struct {
	ent.Schema
}

func (CoinPurchase) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"coin_purchases_amounts_valid": "coins > 0 AND amount_minor >= 0 AND store_fee_minor >= 0 AND clawback_shortfall_coins >= 0",
	})}
}

func (CoinPurchase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CoinPurchase) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("package_id").NotEmpty().MaxLen(60).Immutable(),
		field.Int64("coins").Immutable(),
		field.Enum("channel").Values("web_checkout", "store_iap").Immutable(),
		field.Enum("source").Values("web", "apple", "google").Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("reference").NotEmpty().MaxLen(200).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("store_fee_minor").Default(0),
		field.Enum("status").Values("pending", "succeeded", "failed", "refunded").Default("pending"),
		field.UUID("payment_intent_id", uuid.UUID{}).Optional().Nillable(),
		field.String("authorization_url").MaxLen(2000).Default(""),
		field.Time("credited_at").Optional().Nillable(),
		field.Time("refunded_at").Optional().Nillable(),
		field.Int64("clawback_shortfall_coins").Default(0),
		field.Enum("review_status").Values("pending_review", "reviewed", "reversed").Default("pending_review"),
		field.String("reviewed_by_staff_id").MaxLen(80).Default(""),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("review_note").MaxLen(1000).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CoinPurchase) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("user_id", "created_at"), index.Fields("review_status", "id").Annotations(entsql.DescColumns("id"))}
}

type CoinTransfer struct {
	ent.Schema
}

func (CoinTransfer) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"coin_transfers_split_sums": "coins > 0 AND net_coins > 0 AND fee_coins >= 0 AND net_coins + fee_coins = coins"})}
}

func (CoinTransfer) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CoinTransfer) Fields() []ent.Field {
	return []ent.Field{
		field.String("sender_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("recipient_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("coins").Immutable(),
		field.Int64("fee_coins").Immutable(),
		field.Int64("net_coins").Immutable(),
		field.Int64("fee_bps").Immutable(),
		field.String("note").MaxLen(140).Default("").Immutable(),
		field.Int64("clawback_shortfall_coins").Default(0),
		field.Time("reversed_at").Optional().Nillable(),
		field.Enum("review_status").Values("pending_review", "reviewed", "reversed").Default("pending_review"),
		field.String("reviewed_by_staff_id").MaxLen(80).Default(""),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("review_note").MaxLen(1000).Default(""),
	}
}

func (CoinTransfer) Indexes() []ent.Index {
	return []ent.Index{index.Fields("sender_user_id", "created_at"), index.Fields("recipient_user_id", "created_at"), index.Fields("review_status", "id").Annotations(entsql.DescColumns("id"))}
}

type CoinConversion struct {
	ent.Schema
}

func (CoinConversion) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"coin_conversions_positive": "coins > 0 AND cash_minor > 0 AND coin_cash_value_minor > 0"})}
}

func (CoinConversion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CoinConversion) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("coins").Immutable(),
		field.Int64("cash_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("coin_cash_value_minor").Immutable(),
	}
}

func (CoinConversion) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "created_at")}
}

type WalletRiskFlag struct {
	ent.Schema
}

func (WalletRiskFlag) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (WalletRiskFlag) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("reason").NotEmpty().MaxLen(80).Immutable(),
		field.String("subject_id").MaxLen(80).Default("").Immutable(),
		field.Int64("coins_shortfall").Default(0).Immutable(),
		field.Time("resolved_at").Optional().Nillable(),
	}
}

func (WalletRiskFlag) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "resolved_at")}
}
