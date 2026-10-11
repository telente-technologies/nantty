package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ProviderMovement struct {
	ent.Schema
}

func (ProviderMovement) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"provider_movements_amount_positive":      "amount_minor > 0",
		"provider_movements_one_side_is_a_wallet": "from_wallet_ref <> '' OR to_user_id <> ''",
	})}
}

func (ProviderMovement) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProviderMovement) Fields() []ent.Field {
	return []ent.Field{
		field.String("reference").NotEmpty().MaxLen(60).Immutable(),
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("kind").NotEmpty().MaxLen(40).Immutable(),
		field.String("subject_id").MaxLen(120).Default("").Immutable(),
		field.String("user_id").MaxLen(80).Default("").Immutable(),
		field.String("from_wallet_ref").MaxLen(80).Default("").Immutable(),
		field.String("from_user_id").MaxLen(80).Default("").Immutable(),
		field.String("to_barter_id").MaxLen(80).Default(""),
		field.String("to_wallet_ref").MaxLen(80).Default(""),
		field.Bool("to_platform").Default(false).Immutable(),
		field.String("to_user_id").MaxLen(80).Default("").Immutable(),
		field.Int64("amount_minor").Immutable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Enum("status").Values("pending", "processing", "succeeded", "failed", "cancelled").Default("pending"),
		field.String("provider_transfer_id").MaxLen(120).Default(""),
		field.Int("attempts").Default(0),
		field.String("failure_reason").MaxLen(300).Default(""),
		field.String("blocked_on").MaxLen(120).Default(""),
		field.Time("not_before").Optional().Nillable(),
		field.Time("sent_at").Optional().Nillable(),
		field.Time("finished_at").Optional().Nillable(),
		field.Bytes("metadata").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProviderMovement) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reference").Unique(),
		index.Fields("status", "created_at"),
		index.Fields("kind", "subject_id"),
		index.Fields("from_wallet_ref", "status"),
	}
}

type ReconciliationRun struct {
	ent.Schema
}

func (ReconciliationRun) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReconciliationRun) Fields() []ent.Field {
	return []ent.Field{
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("kind").NotEmpty().MaxLen(40).Immutable(),
		field.Enum("status").Values("running", "clean", "drift", "failed").Default("running"),
		field.Int("wallets_checked").Default(0),
		field.Int("issues_found").Default(0),
		field.Bytes("summary").SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("finished_at").Optional().Nillable(),
	}
}

func (ReconciliationRun) Indexes() []ent.Index {
	return []ent.Index{index.Fields("provider", "kind", "created_at")}
}

type ReconciliationCase struct {
	ent.Schema
}

func (ReconciliationCase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReconciliationCase) Fields() []ent.Field {
	return []ent.Field{
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.String("kind").NotEmpty().MaxLen(60).Immutable(),
		field.String("subject").NotEmpty().MaxLen(160).Immutable(),
		field.String("dedupe_key").NotEmpty().MaxLen(255).Immutable(),
		field.Int64("expected_minor").Default(0).Immutable(),
		field.Int64("actual_minor").Default(0).Immutable(),
		field.String("currency").MaxLen(3).Default("").Immutable(),
		field.String("detail").MaxLen(1000).Default("").Immutable(),
		field.Enum("status").Values("open", "resolved").Default("open"),
		field.Time("resolved_at").Optional().Nillable(),
	}
}

func (ReconciliationCase) Indexes() []ent.Index {
	return []ent.Index{index.Fields("dedupe_key").Unique(), index.Fields("status", "created_at")}
}
