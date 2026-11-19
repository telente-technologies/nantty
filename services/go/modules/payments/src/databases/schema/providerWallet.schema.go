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

type ProviderWallet struct {
	ent.Schema
}

func (ProviderWallet) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderWallet) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("account_ref").NotEmpty().MaxLen(80).Immutable(),
		field.String("barter_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("nuban").MaxLen(20).Default(""),
		field.String("bank_code").MaxLen(20).Default(""),
		field.String("bank_name").MaxLen(120).Default(""),
		field.String("account_name").MaxLen(160).Default(""),
		field.String("alias_email").MaxLen(200).Default(""),
		field.Enum("status").Values("active", "frozen", "closed", "deleted").Default("active"),
		field.String("freeze_reason").MaxLen(300).Default(""),
		field.Time("frozen_at").Optional().Nillable(),
		field.Time("first_funded_at").Optional().Nillable(),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProviderWallet) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider", "user_id", "currency").Unique(),
		index.Fields("provider", "account_ref").Unique(),
		index.Fields("provider", "barter_id").Unique(),
		index.Fields("status"),
	}
}

type ProviderWalletNumber struct {
	ent.Schema
}

func (ProviderWalletNumber) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderWalletNumber) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("wallet_id", uuid.UUID{}).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("account_number").NotEmpty().MaxLen(20).Immutable(),
		field.String("bank_code").MaxLen(20).Default(""),
		field.String("bank_name").MaxLen(120).Default(""),
	}
}

func (ProviderWalletNumber) Indexes() []ent.Index {
	return []ent.Index{index.Fields("provider", "account_number").Unique(), index.Fields("wallet_id")}
}

type WalletFunding struct {
	ent.Schema
}

func (WalletFunding) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"wallet_fundings_amounts_valid": "gross_minor > 0 AND provider_fee_minor >= 0 AND deposit_fee_minor >= 0 AND provider_fee_minor + deposit_fee_minor <= gross_minor",
		"wallet_fundings_debt_valid":    "debt_minor >= 0",
	})}
}

func (WalletFunding) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (WalletFunding) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("wallet_id", uuid.UUID{}).Immutable(),
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_reference").NotEmpty().MaxLen(120).Immutable(),
		field.Enum("source").Values("deposit", "sale", "refund", "earnings").Default("deposit").Immutable(),
		field.String("account_number").MaxLen(20).Default("").Immutable(),
		field.Int64("gross_minor").Immutable(),
		field.Int64("provider_fee_minor").Default(0).Immutable(),
		field.Int64("deposit_fee_minor").Default(0).Immutable(),
		field.Int64("hinted_minor").Default(0).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("status").Values("held", "available", "rejected", "reversal_pending", "reversed").Default("held"),
		field.Time("hold_release_at"),
		field.Time("hold_released_at").Optional().Nillable(),
		field.String("sweep_reference").MaxLen(80).Default(""),
		field.String("reversal_reference").MaxLen(120).Default(""),
		field.Time("reversed_at").Optional().Nillable(),
		field.Int64("debt_minor").Default(0),
		field.Int64("version").Default(0),
	}
}

func (WalletFunding) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider", "provider_reference").Unique(),
		index.Fields("user_id", "created_at"),
		index.Fields("status", "hold_release_at"),
	}
}
