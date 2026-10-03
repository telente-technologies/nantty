package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ShippingProfile struct {
	ent.Schema
}

func (ShippingProfile) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingProfile) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Bool("is_default").Default(false),
		field.Bool("active").Default(true),
		field.Int64("free_shipping_threshold_minor").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ShippingProfile) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "name").Unique(), index.Fields("store_id", "is_default")}
}

type ShippingZone struct {
	ent.Schema
}

func (ShippingZone) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingZone) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.Bool("active").Default(true),
	}
}

func (ShippingZone) Indexes() []ent.Index {
	return []ent.Index{index.Fields("profile_id", "id")}
}

type ShippingDestination struct {
	ent.Schema
}

func (ShippingDestination) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingDestination) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("zone_id", uuid.UUID{}).Immutable(),
		field.String("country_code").NotEmpty().MaxLen(2),
		field.UUID("region_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("admin_area_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (ShippingDestination) Indexes() []ent.Index {
	return []ent.Index{index.Fields("zone_id"), index.Fields("country_code", "region_id", "admin_area_id")}
}

type ShippingRule struct {
	ent.Schema
}

func (ShippingRule) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShippingRule) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("zone_id", uuid.UUID{}).Immutable(),
		field.Int64("fee_minor").Default(0),
		field.Bool("is_free").Default(false),
		field.Int64("free_threshold_minor").Optional().Nillable(),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ShippingRule) Indexes() []ent.Index {
	return []ent.Index{index.Fields("zone_id").Unique()}
}
