package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type FlashSale struct {
	ent.Schema
}

func (FlashSale) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (FlashSale) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.Time("starts_at"),
		field.Time("ends_at"),
		field.Bool("paused").Default(false),
		field.Time("ended_at").Optional().Nillable(),
		field.Int("reach").Default(0),
		field.Int64("revenue_minor").Default(0),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (FlashSale) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "starts_at"), index.Fields("store_id", "ends_at")}
}

type FlashSaleItem struct {
	ent.Schema
}

func (FlashSaleItem) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (FlashSaleItem) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("flash_sale_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.Int("position"),
		field.Int64("sale_price_minor").Positive(),
		field.Int64("original_price_minor"),
		field.Int("stock_cap").Optional().Nillable(),
		field.Int("sold_count").Default(0),
	}
}

func (FlashSaleItem) Indexes() []ent.Index {
	return []ent.Index{index.Fields("flash_sale_id", "product_id").Unique(), index.Fields("store_id", "product_id")}
}

type ProductBundle struct {
	ent.Schema
}

func (ProductBundle) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductBundle) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("description").Default("").MaxLen(300),
		field.Int64("bundle_price_minor").Positive(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("status").Default("draft"),
		field.Int("sold_count").Default(0),
		field.Int64("revenue_minor").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProductBundle) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "status")}
}

type ProductBundleItem struct {
	ent.Schema
}

func (ProductBundleItem) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductBundleItem) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("bundle_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.Int("position"),
		field.Int("quantity").Positive(),
	}
}

func (ProductBundleItem) Indexes() []ent.Index {
	return []ent.Index{index.Fields("bundle_id", "product_id").Unique(), index.Fields("product_id")}
}

type CampaignRedemption struct {
	ent.Schema
}

func (CampaignRedemption) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CampaignRedemption) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.String("campaign_kind").NotEmpty().Immutable(),
		field.UUID("campaign_id", uuid.UUID{}).Immutable(),
		field.Int("units").Immutable(),
		field.Int64("discount_minor").Immutable(),
		field.Int64("revenue_minor").Immutable(),
	}
}

func (CampaignRedemption) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id", "campaign_kind", "campaign_id").Unique(), index.Fields("campaign_id"), index.Fields("store_id", "created_at")}
}
