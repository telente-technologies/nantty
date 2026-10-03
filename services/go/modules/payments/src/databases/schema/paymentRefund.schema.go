package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type PaymentRefund struct {
	ent.Schema
}

func (PaymentRefund) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"payment_refunds_amount_positive": "amount_minor > 0", "payment_refunds_fee_top_up_not_negative": "fee_top_up_minor >= 0"})}
}

func (PaymentRefund) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PaymentRefund) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("payment_intent_id", uuid.UUID{}).Immutable(),
		field.String("reference").NotEmpty().MaxLen(120).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("reason").MaxLen(300).Default("").Immutable(),
		field.String("connected_account_id").MaxLen(80).Default("").Immutable(),
		field.String("beneficiary_user_id").MaxLen(80).Default("").Immutable(),
		field.Bool("full_refund").Default(false).Immutable(),
		field.Int64("fee_top_up_minor").Default(0).Immutable(),
		field.String("fee_top_up_transfer_id").MaxLen(120).Default(""),
		field.Enum("status").Values("pending", "processing", "awaiting_bank_details", "succeeded", "failed").Default("pending"),
		field.Enum("refund_method").Values("provider_refund", "bank_payout").Default("provider_refund"),
		field.String("payout_reference").MaxLen(120).Default(""),
		field.String("provider_refund_id").MaxLen(120).Default(""),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Int("attempt_count").Default(0),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PaymentRefund) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("status", "created_at"), index.Fields("payment_intent_id"), index.Fields("provider_refund_id")}
}
