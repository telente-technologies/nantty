package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SuspensionCase struct {
	ent.Schema
}

func (SuspensionCase) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (SuspensionCase) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("source").Values("python_suggestion", "user_reports", "copyright_strikes").Immutable(),
		field.Enum("status").Values("pending", "escalated", "suspended", "dismissed").Default("pending"),
		field.Int("risk_score").Min(0).Max(100).Immutable(),
		field.Strings("top_signals").Default([]string{}).Immutable(),
		field.Int("report_count").Default(0).Immutable(),
		field.Bytes("signals").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("evidence").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bytes("reports").Optional().Immutable().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.String("model_version").MaxLen(60).Default("").Immutable(),
		field.String("external_reference").MaxLen(128).Optional().Nillable().Immutable(),
		field.Bytes("decision").Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bool("escalated").Default(false),
	}
}

func (SuspensionCase) Indexes() []ent.Index {
	return []ent.Index{index.Fields("external_reference").Unique(), index.Fields("status", "risk_score"), index.Fields("account_id")}
}
