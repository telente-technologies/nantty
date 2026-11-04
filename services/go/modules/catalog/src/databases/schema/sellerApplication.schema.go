package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SellerApplication struct {
	ent.Schema
}

func (SellerApplication) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SellerApplication) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("status").Default("pending").MaxLen(10),
		field.String("store_name").NotEmpty().MaxLen(80).Immutable(),
		field.UUID("category_id", uuid.UUID{}).Immutable(),
		field.String("category_name").Default("").MaxLen(60).Immutable(),
		field.String("description").Default("").MaxLen(1000).Immutable(),
		field.Bytes("phone_sealed").Immutable(),
		field.String("address_line").NotEmpty().MaxLen(200).Immutable(),
		field.String("city").NotEmpty().MaxLen(80).Immutable(),
		field.String("state").NotEmpty().MaxLen(80).Immutable(),
		field.Bool("logistics_enabled").Default(false).Immutable(),
		field.String("identity_document_type").NotEmpty().MaxLen(30).Immutable(),
		field.Bytes("identity_document_number_sealed").Immutable(),
		field.String("identity_document_last4").MaxLen(4).Immutable(),
		field.String("identity_document_photo_url").NotEmpty().MaxLen(2048).Immutable(),
		field.String("payout_bank_code").NotEmpty().MaxLen(10).Immutable(),
		field.String("payout_bank_name").Default("").MaxLen(120).Immutable(),
		field.Bytes("payout_account_number_sealed").Immutable(),
		field.String("payout_account_last4").MaxLen(4).Immutable(),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("reviewed_by_id").Optional().Nillable().MaxLen(80),
		field.String("reviewed_by_name").Optional().Nillable().MaxLen(120),
		field.String("decision_reason").Optional().Nillable().MaxLen(1000),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SellerApplication) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "id"),
		index.Fields("status", "id"),
		index.Fields("account_id").Unique().Annotations(entsql.IndexAnnotation{Where: "status = 'pending'"}).StorageKey("sellerapplication_one_pending_per_account"),
	}
}
