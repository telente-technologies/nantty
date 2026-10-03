package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ProcessedGift struct {
	ent.Schema
}

func (ProcessedGift) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (ProcessedGift) Indexes() []ent.Index {
	return []ent.Index{index.Fields("sender_id", "created_at")}
}

type GiftCombo struct {
	ent.Schema
}

func (GiftCombo) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftCombo) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.String("combo_id").NotEmpty().Immutable(),
		field.String("gift_id").NotEmpty(),
		field.UUID("receiver_id", uuid.UUID{}),
		field.Int("count").Default(0),
		field.String("last_idempotency_key").NotEmpty(),
		field.Time("last_at"),
	}
}

func (GiftCombo) Indexes() []ent.Index {
	return []ent.Index{index.Fields("sender_id", "live_id", "combo_id").Unique()}
}

type GiftContribution struct {
	ent.Schema
}

func (GiftContribution) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftContribution) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.String("scope_key").NotEmpty().Immutable(),
		field.UUID("receiver_id", uuid.UUID{}).Immutable(),
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.Int64("coins").Default(0),
		field.Int64("gift_count").Default(0),
	}
}

func (GiftContribution) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "scope_key", "receiver_id", "sender_id").Unique(), index.Fields("live_id", "scope_key", "sender_id")}
}

type GoalContribution struct {
	ent.Schema
}

func (GoalContribution) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GoalContribution) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("goal_id", uuid.UUID{}).Immutable(),
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.Int64("coins").Default(0),
	}
}

func (GoalContribution) Indexes() []ent.Index {
	return []ent.Index{index.Fields("goal_id", "sender_id").Unique()}
}

type BattleGiftEvent struct {
	ent.Schema
}

func (BattleGiftEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BattleGiftEvent) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("battle_id", uuid.UUID{}).Immutable(),
		field.UUID("sender_id", uuid.UUID{}).Immutable(),
		field.UUID("receiver_id", uuid.UUID{}).Immutable(),
		field.String("gift_id").NotEmpty().Immutable(),
		field.Int64("coins").Immutable(),
	}
}

func (BattleGiftEvent) Indexes() []ent.Index {
	return []ent.Index{index.Fields("battle_id", "created_at")}
}
