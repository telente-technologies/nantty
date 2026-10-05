package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CreatorEarning struct {
	ent.Schema
}

func (CreatorEarning) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorEarning) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("kind").Values("gift", "tip", "subscription", "affiliate", "ad_revenue").Immutable(),
		field.String("reference").NotEmpty().MaxLen(200).Immutable(),
		field.String("source_type").MaxLen(40).Default("").Immutable(),
		field.String("source_id").MaxLen(80).Default("").Immutable(),
		field.String("description").MaxLen(200).Default("").Immutable(),
		field.Int64("gross_minor").Immutable(),
		field.Int64("net_minor").Immutable(),
		field.String("unit").NotEmpty().MaxLen(4).Immutable(),
		field.Enum("status").Values("pending", "available", "reversed").Default("available"),
		field.Time("available_at").Optional().Nillable(),
	}
}

func (CreatorEarning) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("creator_id", "created_at"), index.Fields("creator_id", "kind", "created_at")}
}

type TipTransaction struct {
	ent.Schema
}

func (TipTransaction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (TipTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.String("sender_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("creator_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("target_type").Values("post", "clip", "live").Immutable(),
		field.String("target_id").NotEmpty().MaxLen(80).Immutable(),
		field.Int64("coins").Immutable(),
		field.Int64("creator_coins").Immutable(),
		field.Int64("platform_fee_coins").Immutable(),
		field.Int64("creator_share_bps").Immutable(),
		field.String("idempotency_key").NotEmpty().MaxLen(128).Immutable(),
		field.String("request_hash").NotEmpty().MaxLen(64).Immutable(),
		field.String("ledger_entry_id").MaxLen(80).Immutable(),
	}
}

func (TipTransaction) Indexes() []ent.Index {
	return []ent.Index{index.Fields("sender_user_id", "idempotency_key").Unique(), index.Fields("creator_user_id", "created_at")}
}

type CreatorViolation struct {
	ent.Schema
}

func (CreatorViolation) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorViolation) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("reason").NotEmpty().MaxLen(500).Immutable(),
		field.String("source").MaxLen(40).Default("staff").Immutable(),
		field.String("recorded_by_staff_id").MaxLen(80).Default("").Immutable(),
	}
}

func (CreatorViolation) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "created_at")}
}
