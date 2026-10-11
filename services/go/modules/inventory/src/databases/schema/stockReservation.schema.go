package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockReservation struct {
	ent.Schema
}

func (StockReservation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockReservation) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(120).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.UUID("location_id", uuid.UUID{}).Immutable(),
		field.Int("quantity").Positive().Immutable(),
		field.Int("attempt").NonNegative().Default(0).Immutable(),
		field.String("status").Default("active"),
		field.Time("expires_at").Optional().Nillable(),
		field.Time("settled_at").Optional().Nillable(),
	}
}

func (StockReservation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference", "variant_id", "location_id", "attempt").Unique(),
		index.Fields("expires_at").Annotations(entsql.IndexAnnotation{Where: "status = 'active'"}).StorageKey("stockreservation_active_expiry"),
		index.Fields("store_id", "status"),
	}
}
