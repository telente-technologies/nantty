package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StoreRewardSettings struct {
	ent.Schema
}

func (StoreRewardSettings) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreRewardSettings) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.Bool("enabled").Default(false),
		field.Int("percent_back_basis_points").Default(0),
		field.Int64("minimum_order_minor").Default(0),
		field.Int64("max_per_order_minor").Default(0),
		field.Int("expiry_days").Default(180),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (StoreRewardSettings) Indexes() []ent.Index {
	return []ent.Index{index.Fields("store_id").Unique()}
}

type StoreCreditEntry struct {
	ent.Schema
}

func (StoreCreditEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StoreCreditEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.UUID("order_group_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("kind").NotEmpty().Immutable(),
		field.Int64("amount_minor").Positive().Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Time("expires_at").Optional().Nillable().Immutable(),
		field.String("dedupe_key").NotEmpty().Unique().Immutable(),
	}
}

func (StoreCreditEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "buyer_account_id", "id"),
		index.Fields("buyer_account_id", "id"),
		index.Fields("store_id", "kind", "created_at"),
		index.Fields("expires_at").Annotations(entsql.IndexAnnotation{Where: "kind = 'earn' OR kind = 'restore'"}).StorageKey("storecredit_expiring"),
	}
}
