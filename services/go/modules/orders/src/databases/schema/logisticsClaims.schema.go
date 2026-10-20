package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ShipmentInsurance struct {
	ent.Schema
}

func (ShipmentInsurance) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ShipmentInsurance) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.String("provider").MaxLen(40),
		field.String("insurer").Default("").MaxLen(80),
		field.String("policy_reference").Optional().Nillable().MaxLen(120),
		field.Int64("coverage_amount_minor").NonNegative(),
		field.Int64("premium_minor").NonNegative(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("status").Default("pending").MaxLen(20),
		field.JSON("exclusions", []string{}).Optional(),
		field.JSON("metadata", map[string]any{}).Optional(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ShipmentInsurance) Indexes() []ent.Index {
	return []ent.Index{index.Fields("shipment_id").Unique(), index.Fields("status", "updated_at")}
}

type DeliveryClaim struct {
	ent.Schema
}

func (DeliveryClaim) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (DeliveryClaim) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("shipment_id", uuid.UUID{}).Immutable(),
		field.String("kind").Default("loss").MaxLen(20),
		field.String("status").Default("open").MaxLen(20),
		field.Int64("amount_minor").NonNegative(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("responsible_party").Default("unassigned").MaxLen(20),
		field.String("description").Default("").MaxLen(1000),
		field.JSON("evidence", []string{}).Optional(),
		field.String("resolution").Default("").MaxLen(1000),
		field.Time("opened_at").Default(time.Now),
		field.Time("resolved_at").Optional().Nillable(),
		field.JSON("metadata", map[string]any{}).Optional(),
	}
}

func (DeliveryClaim) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("shipment_id", "id"),
		index.Fields("status", "opened_at"),
	}
}
