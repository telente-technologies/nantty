package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdAccount struct{ ent.Schema }

func (AdAccount) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"ad_accounts_non_negative_balance": "balance_minor >= 0 AND credit_minor >= 0 AND amount_spent_micros >= 0 AND spend_carry_micros >= 0"})}
}

func (AdAccount) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdAccount) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").NotEmpty().MaxLen(120),
		field.Enum("kind").Values("personal", "business"),
		field.UUID("owner_user_id", uuid.UUID{}).Immutable(),
		field.String("store_id").MaxLen(80).Default(""),
		field.String("country_code").MinLen(2).MaxLen(2).Immutable(),
		field.String("currency").MinLen(3).MaxLen(3).Immutable(),
		field.String("timezone").MaxLen(64).Default("Africa/Lagos"),
		field.Enum("status").Values("active", "disabled", "pending_review").Default("active"),
		field.String("disabled_reason").MaxLen(400).Default(""),
		field.Int64("balance_minor").Default(0),
		field.Int64("credit_minor").Default(0),
		field.Time("credit_expires_at").Optional().Nillable(),
		field.Int64("amount_spent_micros").Default(0),
		field.Int64("spend_carry_micros").Default(0),
		field.Int64("spend_limit_minor").Optional().Nillable(),
		field.Enum("funding_mode").Values("prepaid", "card", "prepaid_and_card").Default("prepaid"),
		field.Bool("verified_business").Default(false),
		field.Int("violation_count").Default(0),
		field.Time("last_violation_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdAccount) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_user_id"),
		index.Fields("store_id").Unique().Annotations(entsql.IndexWhere("store_id <> ''")),
		index.Fields("status", "created_at"),
	}
}

type AdAccountMember struct{ ent.Schema }

func (AdAccountMember) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdAccountMember) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("role").Values("admin", "advertiser", "analyst", "billing"),
		field.Bool("is_owner").Default(false),
		field.Time("last_active_at").Optional().Nillable(),
	}
}

func (AdAccountMember) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "user_id").Unique(), index.Fields("user_id")}
}

type AdAccountInvite struct{ ent.Schema }

func (AdAccountInvite) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdAccountInvite) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("invitee_user_id", uuid.UUID{}).Immutable(),
		field.String("invitee_username").MaxLen(60).Immutable(),
		field.Enum("role").Values("admin", "advertiser", "analyst", "billing"),
		field.UUID("invited_by_user_id", uuid.UUID{}).Immutable(),
		field.String("invited_by_name").MaxLen(120).Default(""),
		field.Enum("status").Values("pending", "accepted", "revoked", "expired").Default("pending"),
		field.Time("expires_at"),
	}
}

func (AdAccountInvite) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "status"),
		index.Fields("invitee_user_id", "status"),
		index.Fields("account_id", "invitee_user_id").Unique().Annotations(entsql.IndexWhere("status = 'pending'")),
	}
}

type AdActivityEntry struct{ ent.Schema }

func (AdActivityEntry) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdActivityEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("object_type").MaxLen(40).Immutable(),
		field.String("object_id").MaxLen(80).Immutable(),
		field.String("actor_user_id").MaxLen(80).Default("").Immutable(),
		field.String("actor_name").MaxLen(120).Default("").Immutable(),
		field.String("summary").MaxLen(400).Immutable(),
		field.Bytes("changes").SchemaType(map[string]string{dialect.Postgres: "jsonb"}).Immutable(),
	}
}

func (AdActivityEntry) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at"), index.Fields("account_id", "object_type", "created_at")}
}
