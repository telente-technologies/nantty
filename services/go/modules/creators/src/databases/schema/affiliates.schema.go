package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AffiliateProgramSetting struct {
	ent.Schema
}

func (AffiliateProgramSetting) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable().Comment("store id"),
		field.String("seller_user_id").NotEmpty().MaxLen(80),
		field.String("currency").MaxLen(3).Default(""),
		field.Bool("enabled").Default(false),
		field.Int64("default_commission_bps").Default(0),
		field.Int64("auto_approve_followers_above").Optional().Nillable(),
		field.Int("cookie_window_days").Default(30),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

type AffiliateProductCommission struct {
	ent.Schema
}

func (AffiliateProductCommission) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateProductCommission) Fields() []ent.Field {
	return []ent.Field{
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("product_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("commission_bps").Optional().Nillable(),
		field.Bool("is_excluded").Default(false),
		field.String("updated_by").MaxLen(80).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AffiliateProductCommission) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "product_id").Unique()}
}

type CreatorAffiliation struct {
	ent.Schema
}

func (CreatorAffiliation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorAffiliation) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("product_id").MaxLen(80).Default("").Immutable(),
		field.Enum("status").Values("requested", "active", "paused", "declined", "removed").Default("requested"),
		field.String("message").MaxLen(500).Default(""),
		field.String("decision_reason").MaxLen(300).Default(""),
		field.Time("decided_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CreatorAffiliation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("creator_id", "store_id", "product_id").Unique().Annotations(entsql.IndexWhere("status IN ('requested','active','paused')")).StorageKey("creator_affiliations_open"),
		index.Fields("store_id", "status", "created_at"),
	}
}

type AffiliateCommission struct {
	ent.Schema
}

func (AffiliateCommission) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateCommission) Fields() []ent.Field {
	return []ent.Field{
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("order_number").MaxLen(80).Default("").Immutable(),
		field.String("order_item_id").NotEmpty().MaxLen(120).Immutable(),
		field.String("product_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("attribution_source").NotEmpty().MaxLen(10).Immutable(),
		field.String("attribution_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("sale_minor").Immutable(),
		field.Int64("commission_bps").Immutable(),
		field.Int64("commission_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("product_name").MaxLen(200).Default("").Immutable(),
		field.String("store_name").MaxLen(200).Default("").Immutable(),
		field.String("creator_handle").MaxLen(80).Default("").Immutable(),
		field.Enum("status").Values("pending", "processing", "paid", "reversed").Default("pending"),
		field.Int64("reversed_minor").Default(0),
		field.Time("ordered_at").Optional().Nillable().Immutable(),
		field.Time("paid_at").Optional().Nillable(),
		field.Int("transfer_attempts").Default(0),
		field.Time("retry_after").Optional().Nillable(),
	}
}

func (AffiliateCommission) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_item_id").Unique(), index.Fields("order_id"), index.Fields("store_id", "created_at"), index.Fields("creator_id", "created_at"), index.Fields("status", "id")}
}

type AffiliateCommissionReversal struct {
	ent.Schema
}

func (AffiliateCommissionReversal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateCommissionReversal) Fields() []ent.Field {
	return []ent.Field{
		field.String("commission_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("refund_key").NotEmpty().MaxLen(160).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.Int64("recovered_minor"),
		field.Int64("shortfall_minor"),
		field.Bool("applied").Default(true),
	}
}

func (AffiliateCommissionReversal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("commission_id", "refund_key").Unique()}
}
