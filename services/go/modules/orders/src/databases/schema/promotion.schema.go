package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Promotion struct {
	ent.Schema
}

func (Promotion) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Promotion) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.String("kind").NotEmpty(),
		field.String("code").Optional().Nillable().MaxLen(24),
		field.String("discount_kind").NotEmpty(),
		field.Int64("discount_value").Positive(),
		field.String("scope_kind").Default("all"),
		field.JSON("scope_ids", []string{}).Optional(),
		field.Int64("minimum_spend_minor").Optional().Nillable(),
		field.Int("usage_limit").Optional().Nillable(),
		field.Int("usage_limit_per_customer").Optional().Nillable(),
		field.Int("used_count").Default(0),
		field.Time("starts_at"),
		field.Time("ends_at").Optional().Nillable(),
		field.Bool("disabled").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Promotion) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "code").Unique().Annotations(entsql.IndexAnnotation{Where: "code IS NOT NULL"}).StorageKey("promotion_store_code_unique"),
		index.Fields("store_id", "id").Annotations(entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}),
		index.Fields("store_id", "kind", "starts_at"),
	}
}

type PromotionRedemption struct {
	ent.Schema
}

func (PromotionRedemption) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PromotionRedemption) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("promotion_id", uuid.UUID{}).Immutable(),
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.Int64("discount_minor").Immutable(),
	}
}

func (PromotionRedemption) Indexes() []ent.Index {
	return []ent.Index{index.Fields("order_group_id").Unique(), index.Fields("promotion_id", "buyer_account_id")}
}

type ReturnLine struct {
	OrderItemId string `json:"orderItemId"`
	Quantity    int    `json:"quantity"`
}

type ReturnRequest struct {
	ent.Schema
}

func (ReturnRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReturnRequest) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("order_group_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.UUID("buyer_account_id", uuid.UUID{}).Immutable(),
		field.String("reason").NotEmpty().MaxLen(500).Immutable(),
		field.String("status").Default("requested"),
		field.String("decline_note").Optional().Nillable().MaxLen(500),
		field.Int64("refund_amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.JSON("lines", []ReturnLine{}).Immutable(),
		field.Bool("restocked").Default(false),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ReturnRequest) Indexes() []ent.Index {
	newest := entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}
	return []ent.Index{
		index.Fields("store_id", "status", "id").Annotations(newest).StorageKey("returnrequest_store_status_newest"),
		index.Fields("buyer_account_id", "id").Annotations(newest).StorageKey("returnrequest_buyer_newest"),
		index.Fields("order_group_id", "status"),
	}
}
