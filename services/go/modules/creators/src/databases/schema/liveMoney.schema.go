package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GiftTransaction struct {
	ent.Schema
}

func (GiftTransaction) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"gift_transactions_split_sums": "quantity BETWEEN 1 AND 100 AND unit_price_coins > 0 AND total_coins = platform_fee_coins + creator_amount_coins AND platform_fee_coins >= 0 AND creator_amount_coins >= 0",
	})}
}

func (GiftTransaction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.String("sender_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("receiver_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("credited_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("host_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("live_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("battle_id").MaxLen(80).Default("").Immutable(),
		field.String("gift_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("combo_id").MaxLen(80).Default("").Immutable(),
		field.Int("quantity").Immutable(),
		field.Int64("unit_price_coins").Immutable(),
		field.Int64("total_coins").Immutable(),
		field.Int64("platform_fee_coins").Immutable(),
		field.Int64("creator_amount_coins").Immutable(),
		field.Int64("creator_share_bps").Immutable(),
		field.Enum("status").Values("committed", "heldForReview", "reversed").Default("committed"),
		field.String("idempotency_key").NotEmpty().MaxLen(128).Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
		field.UUID("ledger_entry_id", uuid.UUID{}).Immutable(),
	}
}

func (GiftTransaction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("sender_user_id", "idempotency_key").Unique(),
		index.Fields("battle_id", "receiver_user_id"),
		index.Fields("live_id", "created_at"),
		index.Fields("credited_user_id", "created_at"),
	}
}

type BattleSettlement struct {
	ent.Schema
}

func (BattleSettlement) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BattleSettlement) Fields() []ent.Field {
	return []ent.Field{
		field.String("battle_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("live_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("host_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("requested_rule").Values("keepOwn", "winnerTakesAll").Immutable(),
		field.Enum("rule_applied").Values("keepOwn", "winnerTakesAll").Immutable(),
		field.String("winner_user_id").MaxLen(80).Default("").Immutable(),
		field.Bytes("payouts").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("transfers").Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.UUID("ledger_entry_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
	}
}

func (BattleSettlement) Indexes() []ent.Index {
	return []ent.Index{index.Fields("battle_id").Unique()}
}
