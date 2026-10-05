package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type RefundRecord struct {
	ent.Schema
}

func (RefundRecord) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (RefundRecord) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.String("order_reference").NotEmpty().MaxLen(24).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("source").NotEmpty().MaxLen(20).Immutable(),
		field.String("status").Default("processing").MaxLen(20),
		field.String("reason").Default("").MaxLen(1000).Immutable(),
		field.String("created_by_account_id").Default("").MaxLen(64).Immutable(),
		field.String("created_by_name").Default("").MaxLen(80).Immutable(),
		field.String("idempotency_key").Optional().Nillable().MaxLen(128).Immutable(),
		field.String("request_hash").Default("").MaxLen(64).Immutable(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (RefundRecord) Indexes() []ent.Index {
	newest := entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}
	return []ent.Index{
		index.Fields("order_group_id", "id"),
		index.Fields("source", "id").Annotations(newest),
		index.Fields("created_by_account_id", "idempotency_key").Unique().Annotations(entsql.IndexAnnotation{Where: "idempotency_key IS NOT NULL"}).StorageKey("refundrecord_idempotency"),
	}
}
