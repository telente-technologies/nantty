package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type PayoutAccountResolution struct {
	ent.Schema
}

func (PayoutAccountResolution) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PayoutAccountResolution) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("country_code").NotEmpty().MaxLen(2).Immutable(),
		field.String("bank_code").NotEmpty().MaxLen(20).Immutable(),
		field.String("branch_code").MaxLen(40).Default("").Immutable(),
		field.String("bank_name").NotEmpty().MaxLen(120).Immutable(),
		field.Bytes("account_number_ciphertext").Sensitive().Immutable(),
		field.String("account_number_last4").NotEmpty().MaxLen(4).Immutable(),
		field.String("account_name").NotEmpty().MaxLen(160).Immutable(),
		field.Time("expires_at").Immutable(),
		field.Time("used_at").Optional().Nillable(),
	}
}

func (PayoutAccountResolution) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "expires_at")}
}

type SellerPayoutSchedule struct {
	ent.Schema
}

func (SellerPayoutSchedule) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SellerPayoutSchedule) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3),
		field.String("timezone").Default("Africa/Lagos").MaxLen(60),
		field.Enum("mode").Values("manual", "daily", "weekly", "monthly").Default("manual"),
		field.Int("weekday").Default(1),
		field.Int("day_of_month").Default(1),
		field.Int64("keep_minimum_minor").Default(0),
		field.UUID("payout_account_id", uuid.UUID{}).Optional().Nillable(),
		field.Time("next_run_at").Optional().Nillable(),
		field.String("last_run_on").Default("").MaxLen(10),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SellerPayoutSchedule) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique(), index.Fields("mode", "next_run_at")}
}
