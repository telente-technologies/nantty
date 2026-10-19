package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AffiliateLink struct {
	ent.Schema
}

func (AffiliateLink) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateLink) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("product_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("clicks").Default(0),
		field.Time("last_clicked_at").Optional().Nillable(),
	}
}

func (AffiliateLink) Indexes() []ent.Index {
	return []ent.Index{index.Fields("creator_id", "product_id").Unique(), index.Fields("creator_id", "created_at")}
}

type AffiliateAttributedSale struct {
	ent.Schema
}

func (AffiliateAttributedSale) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateAttributedSale) Fields() []ent.Field {
	return []ent.Field{
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("order_number").MaxLen(80).Default("").Immutable(),
		field.String("order_item_id").NotEmpty().MaxLen(120).Immutable(),
		field.String("product_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("product_name").MaxLen(200).Default("").Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_name").MaxLen(200).Default("").Immutable(),
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("attribution_source").NotEmpty().MaxLen(10).Immutable(),
		field.String("attribution_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("sale_minor").Immutable(),
		field.Int64("commission_bps").Immutable(),
		field.Int64("estimated_commission_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("status").Values("awaiting", "completed", "voided").Default("awaiting"),
		field.String("void_reason").MaxLen(40).Default(""),
		field.Time("ordered_at").Optional().Nillable().Immutable(),
		field.Time("decided_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AffiliateAttributedSale) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_item_id").Unique(), index.Fields("order_id"), index.Fields("creator_id", "status", "created_at")}
}

type AffiliateLinkVisit struct {
	ent.Schema
}

func (AffiliateLinkVisit) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AffiliateLinkVisit) Fields() []ent.Field {
	return []ent.Field{
		field.String("link_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("viewer_key").NotEmpty().MaxLen(64).Immutable().Comment("sha256 of the signed-in user id or of the guest's device id, never a raw identifier"),
		field.Time("last_counted_at"),
	}
}

func (AffiliateLinkVisit) Indexes() []ent.Index {
	return []ent.Index{index.Fields("link_id", "viewer_key").Unique()}
}

type AffiliateOrderVoid struct {
	ent.Schema
}

func (AffiliateOrderVoid) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable().Comment("order group id"),
		field.String("reason").MaxLen(40).Default(""),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}
