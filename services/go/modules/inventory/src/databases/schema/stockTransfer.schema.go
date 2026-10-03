package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StockTransfer struct {
	ent.Schema
}

func (StockTransfer) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockTransfer) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("reference").NotEmpty().MaxLen(20).Immutable(),
		field.UUID("from_location_id", uuid.UUID{}).Immutable(),
		field.UUID("to_location_id", uuid.UUID{}).Immutable(),
		field.String("status").Default("in_transit"),
		field.String("note").Default("").MaxLen(500),
		field.UUID("created_by_account_id", uuid.UUID{}).Immutable(),
		field.Time("received_at").Optional().Nillable(),
		field.Time("cancelled_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StockTransfer) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "reference").Unique(),
		index.Fields("store_id", "status", "id"),
	}
}

type StockTransferLine struct {
	ent.Schema
}

func (StockTransferLine) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StockTransferLine) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("transfer_id", uuid.UUID{}).Immutable(),
		field.UUID("variant_id", uuid.UUID{}).Immutable(),
		field.Int("quantity").Positive().Immutable(),
	}
}

func (StockTransferLine) Indexes() []ent.Index {
	return []ent.Index{index.Fields("transfer_id", "variant_id").Unique()}
}
