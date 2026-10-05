package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"zudomart/modules/subscriptions/src/models"
)

type SubscriptionPeriod struct {
	ent.Schema
}

func (SubscriptionPeriod) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SubscriptionPeriod) Fields() []ent.Field {
	return []ent.Field{
		field.String("subscription_id").NotEmpty().MaxLen(80).Immutable(),
		field.Enum("kind").Values("first", "renewal", "trial_conversion", "upgrade").Immutable(),
		field.String("plan_code").NotEmpty().MaxLen(40).Immutable(),
		field.String("interval").NotEmpty().MaxLen(10).Immutable(),
		field.Time("period_starts_at"),
		field.Time("period_ends_at"),
		field.JSON("line_items", []models.LineItem{}).Default([]models.LineItem{}),
		field.Int64("period_price_minor").Default(0),
		field.Int64("subtotal_minor").Default(0),
		field.Int64("credit_applied_minor").Default(0),
		field.Int64("amount_due_minor").Default(0),
		field.String("currency").NotEmpty().MaxLen(3),
		field.Bool("checkmark_included").Default(true),
		field.Enum("status").Values("open", "paid", "failed", "waived", "void").Default("open"),
		field.Int("attempt_count").Default(0),
		field.String("idempotency_key").NotEmpty().MaxLen(140).Immutable(),
		field.String("payment_reference").MaxLen(80).Default(""),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("paid_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SubscriptionPeriod) Indexes() []ent.Index {
	return []ent.Index{index.Fields("idempotency_key").Unique(), index.Fields("subscription_id", "period_starts_at"), index.Fields("payment_reference")}
}
