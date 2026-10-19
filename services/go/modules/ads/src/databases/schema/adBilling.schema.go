package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdSpendBatch struct{ ent.Schema }

func (AdSpendBatch) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdSpendBatch) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Int("impression_count").Immutable(),
		field.Int64("spend_micros").Immutable(),
		field.Int64("debited_minor").Immutable(),
		field.Int64("creator_share_micros").Immutable(),
		field.Int64("platform_share_micros").Immutable(),
		field.Int64("credit_used_minor").Default(0).Immutable(),
		field.Int64("cashback_minor").Default(0).Immutable(),
		field.Int64("refunded_minor").Default(0),
	}
}

func (AdSpendBatch) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at")}
}

type AdFundsTransaction struct{ ent.Schema }

func (AdFundsTransaction) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdFundsTransaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("type").Values("top_up", "ad_spend", "credit_grant", "credit_spend", "refund", "card_charge", "ad_spend_debt", "credit_expired", "credit_revoked", "cashback", "cashback_reversal", "withdrawal", "withdrawal_reversal", "spend_refund").Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.String("description").MaxLen(200).Immutable(),
		field.String("reference").MaxLen(128).Immutable(),
	}
}

func (AdFundsTransaction) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "reference").Unique(), index.Fields("account_id", "created_at")}
}

type AdCreatorEarning struct{ ent.Schema }

func (AdCreatorEarning) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdCreatorEarning) Fields() []ent.Field {
	return []ent.Field{
		field.String("creator_user_id").MaxLen(80).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Int64("accrued_micros").Default(0),
		field.Int64("posted_minor").Default(0),
		field.Int64("qualified_impressions").Default(0),
	}
}

func (AdCreatorEarning) Indexes() []ent.Index {
	return []ent.Index{index.Fields("creator_user_id", "currency").Unique()}
}

type AdPoolDaily struct{ ent.Schema }

func (AdPoolDaily) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdPoolDaily) Fields() []ent.Field {
	return []ent.Field{
		field.String("day").MaxLen(10).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Int64("gross_micros").Default(0),
		field.Int64("creator_pool_micros").Default(0),
		field.Int64("platform_pool_micros").Default(0),
		field.Int64("qualified_impressions").Default(0),
	}
}

func (AdPoolDaily) Indexes() []ent.Index {
	return []ent.Index{index.Fields("day", "currency").Unique().Annotations(entsql.IndexType("BTREE"))}
}
