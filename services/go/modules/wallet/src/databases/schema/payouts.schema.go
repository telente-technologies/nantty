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

type PayoutAccount struct {
	ent.Schema
}

func (PayoutAccount) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PayoutAccount) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("country_code").NotEmpty().MaxLen(2).Immutable(),
		field.String("bank_code").NotEmpty().MaxLen(20).Immutable(),
		field.String("bank_name").NotEmpty().MaxLen(120).Immutable(),
		field.Bytes("account_number_ciphertext").Sensitive().Immutable(),
		field.String("account_number_fingerprint").NotEmpty().MaxLen(64).Immutable(),
		field.String("account_number_last4").NotEmpty().MaxLen(4).Immutable(),
		field.String("account_name").NotEmpty().MaxLen(160).Immutable(),
		field.Enum("name_match_status").Values("unverified", "matched", "mismatched").Default("unverified"),
		field.Bool("is_default").Default(false),
		field.Time("deleted_at").Optional().Nillable(),
	}
}

func (PayoutAccount) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "deleted_at"), index.Fields("user_id", "account_number_fingerprint", "bank_code")}
}

type Withdrawal struct {
	ent.Schema
}

func (Withdrawal) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"withdrawals_amounts_valid": "amount_minor > 0 AND fee_minor >= 0 AND net_minor > 0 AND net_minor + fee_minor = amount_minor"})}
}

func (Withdrawal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Withdrawal) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.UUID("payout_account_id", uuid.UUID{}).Immutable(),
		field.String("reference").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.Int64("fee_minor").Immutable(),
		field.Int64("net_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("destination_label").MaxLen(200).Default("").Immutable(),
		field.Enum("status").Values("pending_review", "on_hold", "queued", "processing", "paid", "failed", "cancelled").Default("pending_review"),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.String("reviewed_by_staff_id").MaxLen(80).Default(""),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("review_note").MaxLen(1000).Default(""),
		field.Time("processed_at").Optional().Nillable(),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Withdrawal) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("user_id", "id").Annotations(entsql.DescColumns("id")),
		index.Fields("status", "id").Annotations(entsql.DescColumns("id")),
		index.Fields("created_at").Annotations(entsql.IndexWhere("status = 'queued'")).StorageKey("withdrawal_queued_created_at"),
	}
}
