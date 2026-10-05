package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type OrderGroup struct {
	ent.Schema
}

func (OrderGroup) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OrderGroup) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("checkout_id", uuid.UUID{}).Immutable(),
		field.String("reference").NotEmpty().MaxLen(24).Immutable(),
		field.String("invoice_number").NotEmpty().MaxLen(24).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("seller_account_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.String("buyer_name").Default("").MaxLen(80),
		field.String("buyer_username").Default("").MaxLen(40),
		field.String("status").Default("pending"),
		field.String("previous_status").Default(""),
		field.String("payment_status").Default("pending"),
		field.String("payment_mode").Default("escrow").MaxLen(10).Immutable(),
		field.String("delivery_status").Default("pending"),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("subtotal_minor").Immutable(),
		field.Int64("discount_minor").Default(0).Immutable(),
		field.UUID("promotion_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Int64("store_credit_minor").Default(0).Immutable(),
		field.Int64("shipping_minor").Immutable(),
		field.Int64("total_minor").Immutable(),
		field.Int64("refunded_minor").Default(0),
		field.JSON("address", AddressSnapshot{}).Immutable(),
		field.Bool("stock_reserved").Default(false),
		field.String("courier_name").Optional().Nillable().MaxLen(60),
		field.String("tracking_number").Optional().Nillable().MaxLen(40),
		field.String("tracking_url").Optional().Nillable().MaxLen(300),
		field.UUID("from_location_id", uuid.UUID{}).Optional().Nillable(),
		field.String("rider_name").Optional().Nillable().MaxLen(60),
		field.String("rider_phone").Optional().Nillable().MaxLen(20),
		field.Int("delivery_attempts").Default(0),
		field.String("last_attempt_note").Optional().Nillable().MaxLen(300),
		field.Time("estimated_delivery_at").Optional().Nillable(),
		field.Time("paid_at").Optional().Nillable(),
		field.Time("shipped_at").Optional().Nillable(),
		field.Time("delivered_at").Optional().Nillable(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("escrow_release_at").Optional().Nillable(),
		field.Time("refund_requested_at").Optional().Nillable(),
		field.String("cancel_reason").Optional().Nillable().MaxLen(500),
		field.Int("version").Default(1),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (OrderGroup) Indexes() []ent.Index {
	newest := entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("store_id", "invoice_number").Unique(),
		index.Fields("buyer_account_id", "id").Annotations(newest).StorageKey("ordergroup_buyer_newest"),
		index.Fields("buyer_account_id", "status", "id").Annotations(newest).StorageKey("ordergroup_buyer_status_newest"),
		index.Fields("store_id", "status", "id").Annotations(newest).StorageKey("ordergroup_store_status_newest"),
		index.Fields("store_id", "buyer_account_id"),
		index.Fields("checkout_id"),
		index.Fields("created_at").StorageKey("ordergroup_created"),
		index.Fields("escrow_release_at").Annotations(entsql.IndexAnnotation{Where: "status = 'delivered'"}).StorageKey("ordergroup_delivered_release"),
	}
}

type OrderItem struct {
	ent.Schema
}

func (OrderItem) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OrderItem) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.String("product_name").NotEmpty().MaxLen(120).Immutable(),
		field.String("variant_title").Default("").MaxLen(200).Immutable(),
		field.String("sku").Default("").MaxLen(64).Immutable(),
		field.String("size").Default("").MaxLen(40).Immutable(),
		field.String("color").Default("").MaxLen(40).Immutable(),
		field.String("image_url").Optional().Nillable().MaxLen(500).Immutable(),
		field.Int64("unit_price_minor").Immutable(),
		field.Int("quantity").Positive().Immutable(),
		field.Int64("line_total_minor").Immutable(),
		field.Int64("cost_price_minor").Optional().Nillable().Immutable(),
		field.UUID("category_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("category_name").Default("").MaxLen(60).Immutable(),
		field.Bool("tracks_stock").Default(true).Immutable(),
		field.Bool("taxable").Default(true).Immutable(),
		field.String("attribution_source").Optional().Nillable().MaxLen(10).Immutable(),
		field.UUID("attribution_id", uuid.UUID{}).Optional().Nillable().Immutable(),
	}
}

func (OrderItem) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id"), index.Fields("store_id", "product_id"), index.Fields("product_id")}
}

type OrderEvent struct {
	ent.Schema
}

func (OrderEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OrderEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.String("kind").NotEmpty().Immutable(),
		field.String("summary").Default("").MaxLen(300).Immutable(),
		field.String("actor_kind").Default("system").Immutable(),
		field.UUID("actor_account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("actor_name").Default("").MaxLen(80).Immutable(),
	}
}

func (OrderEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id", "id")}
}

type OrderNote struct {
	ent.Schema
}

func (OrderNote) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (OrderNote) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("author_account_id", uuid.UUID{}).Immutable(),
		field.String("author_name").Default("").MaxLen(80).Immutable(),
		field.String("body").NotEmpty().MaxLen(1000).Immutable(),
	}
}

func (OrderNote) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id", "id")}
}

type ShippingCalculation struct {
	ent.Schema
}

func (ShippingCalculation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingCalculation) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("profile_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("zone_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("rule_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("outcome").NotEmpty().Immutable(),
		field.String("matched_level").Default("").Immutable(),
		field.String("zone_name").Default("").MaxLen(60).Immutable(),
		field.String("destination_label").Default("").MaxLen(300).Immutable(),
		field.Int64("order_subtotal_minor").Immutable(),
		field.Int64("fee_minor").Immutable(),
		field.Int64("threshold_applied_minor").Optional().Nillable().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
	}
}

func (ShippingCalculation) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id").Unique()}
}

type ProcessedEvent struct {
	ent.Schema
}

func (ProcessedEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProcessedEvent) Fields() []ent.Field {
	return []ent.Field{field.String("envelope_id").NotEmpty().Immutable(), field.String("event_type").NotEmpty().Immutable()}
}

func (ProcessedEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("envelope_id").Unique()}
}
