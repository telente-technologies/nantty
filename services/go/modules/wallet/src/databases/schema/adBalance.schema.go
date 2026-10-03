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

type AdBalanceTopUp struct {
	ent.Schema
}

func (AdBalanceTopUp) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"ad_balance_top_ups_amount_positive": "amount_minor > 0", "ad_balance_top_ups_refund_within_amount": "refunded_minor >= 0 AND refunded_minor <= amount_minor"})}
}

func (AdBalanceTopUp) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AdBalanceTopUp) Fields() []ent.Field {
	return []ent.Field{
		field.String("ad_account_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("funded_by_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("reference").NotEmpty().MaxLen(80).Immutable(),
		field.UUID("payment_intent_id", uuid.UUID{}).Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("status").Values("pending", "succeeded", "failed").Default("pending"),
		field.Int64("refunded_minor").Default(0),
		field.Time("credited_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdBalanceTopUp) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("ad_account_id", "status", "created_at"), index.Fields("funded_by_user_id", "created_at")}
}

type AdSpendDebit struct {
	ent.Schema
}

func (AdSpendDebit) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (AdSpendDebit) Fields() []ent.Field {
	return []ent.Field{
		field.String("batch_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(160).Immutable(),
		field.String("ad_account_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("requested_minor").Immutable(),
		field.Int64("debited_minor").Immutable(),
		field.Int64("shortfall_minor").Immutable(),
		field.Int64("impression_count").Default(0).Immutable(),
	}
}

func (AdSpendDebit) Indexes() []ent.Index {
	return []ent.Index{index.Fields("idempotency_key").Unique(), index.Fields("ad_account_id", "created_at")}
}

type SellerReserveFlag struct {
	ent.Schema
}

func (SellerReserveFlag) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SellerReserveFlag) Fields() []ent.Field {
	return []ent.Field{
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("reserve_bps").Default(0),
		field.Int("hold_days").Default(90),
		field.String("reason").NotEmpty().MaxLen(300),
		field.String("flagged_by_staff_id").NotEmpty().MaxLen(80).Immutable(),
		field.Time("released_at").Optional().Nillable(),
		field.String("released_by_staff_id").MaxLen(80).Default(""),
	}
}

func (SellerReserveFlag) Indexes() []ent.Index {
	return []ent.Index{index.Fields("seller_user_id").Unique().Annotations(entsql.IndexWhere("released_at IS NULL")).StorageKey("seller_reserve_flags_active")}
}
