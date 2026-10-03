package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ConnectedAccount struct {
	ent.Schema
}

func (ConnectedAccount) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ConnectedAccount) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_account_id").MaxLen(120).Default(""),
		field.Enum("status").Values("pending_creation", "created", "failed").Default("created"),
		field.String("last_error").MaxLen(500).Default(""),
		field.Enum("verification_status").Values("not_started", "documentsRequired", "inProgress", "underReview", "actionNeeded", "verified").Default("not_started"),
		field.Bytes("verification_reasons").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("verification_status_changed_at").Optional().Nillable(),
		field.Time("verification_nudged_at").Optional().Nillable(),
		field.Bool("accepts_payments").Default(false),
		field.Strings("roles").Optional(),
		field.String("recipient_code").MaxLen(60).Default(""),
		field.String("settlement_subaccount_code").MaxLen(60).Default(""),
		field.String("escrow_subaccount_code").MaxLen(60).Default(""),
		field.String("bank_code").MaxLen(20).Default(""),
		field.String("account_last4").MaxLen(4).Default(""),
		field.String("account_name").MaxLen(160).Default(""),
		field.Bytes("capability_statuses").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("outstanding_requirements").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("requirements_deadline_at").Optional().Nillable(),
		field.Bool("manual_payout_schedule_confirmed").Default(false),
		field.Bool("payouts_frozen").Default(false),
		field.String("payouts_frozen_reason").MaxLen(300).Default(""),
		field.String("virtual_account_number").MaxLen(20).Default(""),
		field.String("virtual_account_bank_name").MaxLen(120).Default(""),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ConnectedAccount) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id", "provider").Unique(), index.Fields("provider_account_id").Unique().Annotations(entsql.IndexWhere("provider_account_id <> ''")), index.Fields("status", "updated_at")}
}

type ProviderPayoutDestination struct {
	ent.Schema
}

func (ProviderPayoutDestination) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderPayoutDestination) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("connected_account_id", uuid.UUID{}).Immutable(),
		field.String("account_fingerprint").NotEmpty().MaxLen(64).Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.String("bank_code").NotEmpty().MaxLen(20).Immutable(),
		field.String("account_last4").MaxLen(4).Default("").Immutable(),
		field.String("provider_destination_id").NotEmpty().MaxLen(120).Immutable(),
	}
}

func (ProviderPayoutDestination) Indexes() []ent.Index {
	return []ent.Index{index.Fields("connected_account_id", "account_fingerprint", "currency").Unique()}
}

type ProviderDispute struct {
	ent.Schema
}

func (ProviderDispute) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderDispute) Fields() []ent.Field {
	return []ent.Field{
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("provider_dispute_id").NotEmpty().MaxLen(120).Immutable(),
		field.String("provider_charge_id").MaxLen(120).Default("").Immutable(),
		field.String("connected_account_id").MaxLen(120).Default("").Immutable(),
		field.UUID("payment_intent_id", uuid.UUID{}).Optional().Nillable(),
		field.Int64("amount_minor").Default(0),
		field.String("currency").MaxLen(3).Default(""),
		field.String("status").MaxLen(40).Default(""),
		field.String("reason").MaxLen(120).Default(""),
		field.Time("response_deadline_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProviderDispute) Indexes() []ent.Index {
	return []ent.Index{index.Fields("provider", "provider_dispute_id").Unique(), index.Fields("status")}
}

type BillingSubscription struct {
	ent.Schema
}

func (BillingSubscription) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BillingSubscription) Fields() []ent.Field {
	return []ent.Field{
		field.String("owner_user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("plan_code").NotEmpty().MaxLen(60).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("reference").NotEmpty().MaxLen(120).Immutable(),
		field.String("provider_product_id").NotEmpty().MaxLen(120).Immutable(),
		field.String("provider_checkout_id").MaxLen(120).Default(""),
		field.String("provider_subscription_id").MaxLen(120).Default(""),
		field.String("provider_customer_id").MaxLen(120).Default(""),
		field.String("email_token").MaxLen(120).Default("").Sensitive(),
		field.String("status").NotEmpty().MaxLen(40).Default("pending_checkout"),
		field.Time("trial_ends_at").Optional().Nillable(),
		field.Time("current_period_ends_at").Optional().Nillable(),
		field.Time("downgraded_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (BillingSubscription) Indexes() []ent.Index {
	return []ent.Index{index.Fields("reference").Unique(), index.Fields("provider_subscription_id"), index.Fields("owner_user_id", "plan_code"), index.Fields("provider_customer_id", "provider_product_id")}
}
