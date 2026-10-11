package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PayoutTransfer struct {
	ent.Schema
}

func (PayoutTransfer) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"payout_transfers_amount_positive": "amount_minor > 0", "payout_transfers_fee_not_negative": "fee_minor >= 0"})}
}

func (PayoutTransfer) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PayoutTransfer) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(120).Immutable(),
		field.String("purpose").NotEmpty().MaxLen(40).Immutable(),
		field.String("subject_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("kind").Values("payout", "platform_transfer").Default("payout").Immutable(),
		field.String("connected_account_id").MaxLen(80).Default("").Immutable(),
		field.String("beneficiary_user_id").MaxLen(80).Default("").Immutable(),
		field.String("transfer_group").MaxLen(120).Default("").Immutable(),
		field.String("provider_destination_id").MaxLen(120).Default(""),
		field.Int64("fee_minor").Default(0),
		field.String("bank_code").MaxLen(20).Default("").Immutable(),
		field.String("destination_last4").MaxLen(4).Default("").Immutable(),
		field.String("source_wallet_ref").MaxLen(80).Default("").Immutable(),
		field.Bytes("sealed_destination").Optional().Nillable().Sensitive().Immutable(),
		field.Enum("status").Values("processing", "succeeded", "failed").Default("processing"),
		field.String("provider_transfer_code").MaxLen(120).Default(""),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PayoutTransfer) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("purpose", "subject_id"), index.Fields("status", "created_at"), index.Fields("provider_transfer_code"), index.Fields("connected_account_id", "status")}
}
