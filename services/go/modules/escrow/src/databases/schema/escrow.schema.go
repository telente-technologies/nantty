package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Escrow struct {
	ent.Schema
}

func (Escrow) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"escrows_amount_positive":              "amount_minor > 0",
		"escrows_split_and_fees_sum_to_amount": "commission_minor >= 0 AND seller_amount_minor >= 0 AND processing_fee_minor >= 0 AND commission_minor + seller_amount_minor + processing_fee_minor = amount_minor",
		"escrows_refund_within_amount":         "refunded_minor >= 0 AND refunded_minor <= amount_minor",
		"escrows_commission_bps_in_range":      "commission_bps >= 0 AND commission_bps <= 10000",
	})}
}

func (Escrow) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Escrow) Fields() []ent.Field {
	return []ent.Field{
		field.String("order_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("order_reference").NotEmpty().MaxLen(80).Immutable(),
		field.String("checkout_id").NotEmpty().MaxLen(80).Immutable(),
		field.UUID("payment_intent_id", uuid.UUID{}).Immutable(),
		field.String("payment_reference").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("buyer_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("store_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("seller_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("product_summary").MaxLen(300).Default("").Immutable(),
		field.Enum("payment_mode").Values("escrow", "direct").Default("escrow").Immutable(),
		field.Enum("custody").Values("sellerEscrow", "buyerWalletLock").Default("sellerEscrow").Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("commission_bps").Immutable(),
		field.Int64("commission_minor").Immutable(),
		field.Int64("seller_amount_minor").Immutable(),
		field.Int64("processing_fee_minor").Default(0).Immutable(),
		field.Int64("refunded_minor").Default(0),
		field.Int64("released_to_seller_minor").Default(0),
		field.Enum("status").Values("held", "disputed", "released", "refunded", "partiallyRefunded", "clawedBack").Default("held"),
		field.Time("shipped_at").Optional().Nillable(),
		field.Time("estimated_delivery_at").Optional().Nillable(),
		field.String("courier_name").MaxLen(120).Default(""),
		field.String("tracking_number").MaxLen(120).Default(""),
		field.String("tracking_url").MaxLen(500).Default(""),
		field.Time("delivered_at").Optional().Nillable(),
		field.Time("auto_release_at").Optional().Nillable(),
		field.Int64("paused_release_remaining_seconds").Optional().Nillable(),
		field.Time("buyer_confirmed_at").Optional().Nillable(),
		field.Time("released_at").Optional().Nillable(),
		field.Time("refunded_at").Optional().Nillable(),
		field.String("release_trigger").MaxLen(40).Default(""),
		field.Time("wallet_funded_at").Optional().Nillable(),
		field.Int64("wallet_hold_minor").Default(0),
		field.String("direct_payout_reference").MaxLen(120).Default(""),
		field.Time("direct_paid_out_at").Optional().Nillable(),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Escrow) Edges() []ent.Edge {
	return []ent.Edge{edge.To("disputes", Dispute.Type)}
}

func (Escrow) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("order_id").Unique(),
		index.Fields("status", "auto_release_at"),
		index.Fields("seller_user_id", "status", "id").Annotations(entsql.DescColumns("id")),
		index.Fields("payment_intent_id"),
		index.Fields("buyer_user_id", "created_at"),
		index.Fields("checkout_id"),
	}
}
