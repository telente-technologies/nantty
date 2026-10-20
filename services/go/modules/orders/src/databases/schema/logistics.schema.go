package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// DeliveryPolicy stores the seller's free-delivery and subsidy rules. It is
// deliberately separate from ShippingProfile: provider delivery needs a
// funding party and a cap that the existing flat shipping rules do not carry.
type DeliveryPolicy struct {
	ent.Schema
}

func (DeliveryPolicy) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeliveryPolicy) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.Bool("active").Default(true),
		field.String("funding_party").Default("seller").MaxLen(20),
		field.Int64("free_shipping_threshold_minor").Optional().Nillable().NonNegative(),
		field.Int64("seller_subsidy_cap_minor").Optional().Nillable().NonNegative(),
		field.JSON("eligible_category_ids", []string{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (DeliveryPolicy) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id").Unique()}
}

type DeliveryRoute struct {
	PickupLabel          string   `json:"pickupLabel"`
	PickupLatitude       *float64 `json:"pickupLatitude,omitempty"`
	PickupLongitude      *float64 `json:"pickupLongitude,omitempty"`
	DestinationLabel     string   `json:"destinationLabel"`
	DestinationLatitude  *float64 `json:"destinationLatitude,omitempty"`
	DestinationLongitude *float64 `json:"destinationLongitude,omitempty"`
}

// DeliveryQuote is a provider quote captured before payment. The order group
// link is filled only when the quote is attached to a created order.
type DeliveryQuote struct {
	ent.Schema
}

func (DeliveryQuote) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeliveryQuote) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("checkout_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("order_group_id", uuid.UUID{}).Optional().Nillable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_quote_id").Optional().Nillable().MaxLen(120),
		field.String("service_type").Default("door_to_door").MaxLen(40).Immutable(),
		field.String("status").Default("quoted").MaxLen(20),
		field.Int64("amount_minor").NonNegative(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.JSON("route", DeliveryRoute{}),
		field.Time("expires_at"),
		field.JSON("conditions", []string{}).Optional(),
		field.JSON("metadata", map[string]any{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (DeliveryQuote) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "status", "expires_at"),
		index.Fields("checkout_id"),
		index.Fields("order_group_id"),
		index.Fields("provider", "provider_quote_id").Unique().
			Annotations(entsql.IndexAnnotation{Where: "provider_quote_id IS NOT NULL"}).
			StorageKey("deliveryquote_provider_quote_unique"),
	}
}

type Shipment struct {
	ent.Schema
}

func (Shipment) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Shipment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_reference").Optional().Nillable().MaxLen(120),
		field.UUID("quote_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("status").Default("pending").MaxLen(30),
		field.String("previous_status").Default("").MaxLen(30),
		field.String("service_type").Default("door_to_door").MaxLen(40).Immutable(),
		field.JSON("pickup_address", AddressSnapshot{}).Immutable(),
		field.JSON("destination_address", AddressSnapshot{}).Immutable(),
		field.String("tracking_number").Optional().Nillable().MaxLen(80),
		field.String("tracking_url").Optional().Nillable().MaxLen(300),
		field.String("delivery_pin_hash").Optional().Nillable().MaxLen(128),
		field.Time("booked_at").Optional().Nillable(),
		field.Time("ready_for_pickup_at").Optional().Nillable(),
		field.Time("picked_up_at").Optional().Nillable(),
		field.Time("delivered_at").Optional().Nillable(),
		field.Time("cancelled_at").Optional().Nillable(),
		field.Time("estimated_delivery_at").Optional().Nillable(),
		field.String("cancellation_reason").Optional().Nillable().MaxLen(300),
		field.JSON("metadata", map[string]any{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Shipment) Indexes() []ent.Index {
	newest := entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}
	return []ent.Index{
		index.Fields("order_group_id").Unique(),
		index.Fields("store_id", "status", "id").Annotations(newest).StorageKey("shipment_store_status_newest"),
		index.Fields("status", "updated_at"),
		index.Fields("provider", "provider_reference").Unique().
			Annotations(entsql.IndexAnnotation{Where: "provider_reference IS NOT NULL"}).
			StorageKey("shipment_provider_reference_unique"),
	}
}

type Parcel struct {
	ent.Schema
}

func (Parcel) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Parcel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.Int("weight_grams").Positive(),
		field.Int("length_mm").Positive(),
		field.Int("width_mm").Positive(),
		field.Int("height_mm").Positive(),
		field.String("package_category").Default("general").MaxLen(40),
		field.Int("package_count").Default(1).Positive(),
		field.Bool("fragile").Default(false),
		field.String("contents_description").Default("").MaxLen(300),
		field.Int64("declared_value_minor").NonNegative(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.JSON("metadata", map[string]any{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Parcel) Indexes() []ent.Index {
	return []ent.Index{index.Fields("shipment_id").Unique()}
}

type DeliveryAttempt struct {
	ent.Schema
}

func (DeliveryAttempt) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeliveryAttempt) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.Int("attempt_number").Positive(),
		field.String("status").Default("failed").MaxLen(20),
		field.String("failure_reason").Default("").MaxLen(60),
		field.String("responsible_party").Default("unassigned").MaxLen(20),
		field.String("evidence").Default("").MaxLen(1000),
		field.Time("attempted_at"),
		field.JSON("metadata", map[string]any{}).Optional(),
	}
}

func (DeliveryAttempt) Indexes() []ent.Index {
	return []ent.Index{index.Fields("shipment_id", "attempt_number").Unique()}
}

type ShipmentEvent struct {
	ent.Schema
}

func (ShipmentEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShipmentEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.String("provider").MaxLen(40),
		field.String("provider_event_id").Optional().Nillable().MaxLen(120),
		field.String("kind").MaxLen(40),
		field.String("status").MaxLen(30),
		field.String("source").Default("webhook").MaxLen(20),
		field.JSON("payload", map[string]any{}).Optional(),
		field.Time("occurred_at"),
		field.Time("received_at").Default(time.Now),
	}
}

func (ShipmentEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("shipment_id", "occurred_at"),
		index.Fields("provider", "provider_event_id").Unique().
			Annotations(entsql.IndexAnnotation{Where: "provider_event_id IS NOT NULL"}).
			StorageKey("shipevent_provider_event_unique"),
	}
}

type ShipmentCharge struct {
	ent.Schema
}

func (ShipmentCharge) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShipmentCharge) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.String("kind").MaxLen(30),
		field.String("funding_party").Default("unassigned").MaxLen(20),
		field.Int64("amount_minor"),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("reference").Optional().Nillable().MaxLen(120),
		field.JSON("metadata", map[string]any{}).Optional(),
	}
}

func (ShipmentCharge) Indexes() []ent.Index {
	return []ent.Index{index.Fields("shipment_id", "kind")}
}
