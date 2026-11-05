package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type CreatorApplication struct {
	ent.Schema
}

func (CreatorApplication) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorApplication) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("idempotency_key").Optional().Nillable().MaxLen(128).Immutable(),
		field.String("request_hash").Optional().Nillable().MaxLen(64).Immutable(),
		field.UUID("profile_id", uuid.UUID{}).Immutable(),
		field.Enum("status").Values("pending", "approved", "rejected").Default("pending"),
		field.Enum("decision").Values("auto_approve", "manual_review", "not_eligible").Immutable(),
		field.String("decision_note").Default("").MaxLen(500),
		field.Bytes("requirements").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Strings("content_categories").Default([]string{}),
		field.Bytes("social_links").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Strings("sample_content_urls").Default([]string{}),
		field.String("payout_account_id").Default("").MaxLen(64),
		field.String("accepted_terms_version").Default("").MaxLen(40),
		field.String("reviewed_by").Default("").MaxLen(64),
		field.String("reviewed_by_name").Default("").MaxLen(120),
		field.Time("reviewed_at").Optional().Nillable(),
		field.String("decision_reason").Default("").MaxLen(1000),
		field.Time("reapply_available_at").Optional().Nillable(),
	}
}

func (CreatorApplication) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "idempotency_key").Unique(), index.Fields("account_id", "created_at"), index.Fields("status", "created_at")}
}
