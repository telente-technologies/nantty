package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StoreCustomerProfile struct {
	ent.Schema
}

func (StoreCustomerProfile) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreCustomerProfile) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("name").Default("").MaxLen(80),
		field.String("phone").Optional().Nillable().MaxLen(20),
		field.String("email").Optional().Nillable().MaxLen(120),
		field.JSON("tags", []string{}).Optional(),
		field.Bool("marketing_opt_in").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StoreCustomerProfile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "buyer_account_id").Unique().Annotations(entsql.IndexWhere("buyer_account_id IS NOT NULL")),
		index.Fields("store_id", "phone"),
		index.Fields("store_id", "email"),
	}
}

type CustomerSegmentRule struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

type CustomerSegment struct {
	ent.Schema
}

func (CustomerSegment) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CustomerSegment) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("description").Default("").MaxLen(200),
		field.JSON("rules", []CustomerSegmentRule{}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CustomerSegment) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "id")}
}

type DeliveryArea struct {
	ent.Schema
}

func (DeliveryArea) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeliveryArea) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("state").NotEmpty().MaxLen(40),
		field.JSON("cities", []string{}),
		field.Int64("fee_minor").NonNegative(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Int("estimated_days_min").NonNegative(),
		field.Int("estimated_days_max").NonNegative(),
		field.Bool("active").Default(true),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (DeliveryArea) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id", "id")}
}
