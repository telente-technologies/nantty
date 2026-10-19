package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdCreditLot struct{ ent.Schema }

func (AdCreditLot) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdCreditLot) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"ad_credit_lots_amounts": "remaining_minor >= 0 AND remaining_minor <= original_minor AND original_minor > 0"})}
}

func (AdCreditLot) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Enum("source").Values("admin_issued", "cashback", "premium_free_boost", "boost_refund", "legacy").Immutable(),
		field.Int64("original_minor").Immutable(),
		field.Int64("remaining_minor"),
		field.Time("expires_at").Optional().Nillable().Immutable(),
		field.Enum("status").Values("active", "spent", "expired", "revoked").Default("active"),
		field.String("reason").MaxLen(500).Default("").Immutable(),
		field.String("reference").MaxLen(128).Immutable(),
		field.String("issued_by_staff_id").MaxLen(80).Default("").Immutable(),
		field.String("issued_by_name").MaxLen(120).Default("").Immutable(),
		field.UUID("boost_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("spend_batch_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Int64("expired_minor").Default(0),
		field.Int64("revoked_minor").Default(0),
		field.Time("revoked_at").Optional().Nillable(),
		field.String("revoked_by_staff_id").MaxLen(80).Default(""),
		field.String("revoke_reason").MaxLen(500).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdCreditLot) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("account_id", "status", "expires_at"),
		index.Fields("status", "expires_at"),
		index.Fields("user_id", "created_at"),
		index.Fields("boost_id"),
	}
}

type AdCashbackSetting struct{ ent.Schema }

func (AdCashbackSetting) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdCashbackSetting) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Bool("enabled").Default(false),
		field.Int("percent").Default(10).Range(1, 50),
		field.String("reason").MaxLen(500).Default(""),
		field.String("updated_by_staff_id").MaxLen(80).Default(""),
		field.String("updated_by_name").MaxLen(120).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdCashbackSetting) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique(), index.Fields("enabled", "updated_at")}
}

type AdBalanceWithdrawal struct{ ent.Schema }

func (AdBalanceWithdrawal) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdBalanceWithdrawal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").MaxLen(128).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.Int64("gross_minor").Immutable(),
		field.Int64("fee_minor").Immutable(),
		field.Int64("net_minor").Immutable(),
		field.Enum("status").Values("pending", "completed", "failed").Default("pending"),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdBalanceWithdrawal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "idempotency_key").Unique(), index.Fields("status", "created_at"), index.Fields("account_id", "created_at")}
}
