package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GiftTransaction struct {
	ent.Schema
}

func (GiftTransaction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.UUID("receiver_id", uuid.UUID{}).Immutable(),
		field.UUID("credited_user_id", uuid.UUID{}).Immutable(),
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("battle_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("gift_id").NotEmpty().Immutable(),
		field.Int("quantity").Immutable(),
		field.Int64("unit_price_coins").Immutable(),
		field.Int64("total_coins").Immutable(),
		field.Int64("platform_fee_coins").Immutable(),
		field.Int64("creator_amount_coins").Immutable(),
		field.Enum("status").Values("committed", "heldForReview", "reversed").Default("committed"),
		field.String("idempotency_key").NotEmpty().Immutable(),
		field.String("ledger_transaction_id").Default("").Immutable(),
		field.String("combo_id").Optional().Nillable().Immutable(),
		field.Int("combo_count").Default(1).Immutable(),
		field.Int64("sender_coin_balance_after").Immutable(),
	}
}

func (GiftTransaction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("sender_id", "idempotency_key").Unique(),
		index.Fields("live_id", "created_at"),
		index.Fields("battle_id", "receiver_id"),
		index.Fields("sender_id", "created_at"),
	}
}

type GiftGoal struct {
	ent.Schema
}

func (GiftGoal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftGoal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("creator_id", uuid.UUID{}).Immutable(),
		field.String("title").NotEmpty().MaxLen(80),
		field.Int64("target_coins").Positive(),
		field.String("gift_id").Optional().Nillable(),
		field.Int64("progress_coins").Default(0),
		field.Enum("status").Values("active", "completed", "cancelled").Default("active"),
		field.Time("completed_at").Optional().Nillable(),
	}
}

func (GiftGoal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "status")}
}
