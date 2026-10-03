package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type LedgerAccount struct {
	ent.Schema
}

func (LedgerAccount) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"ledger_accounts_balance_not_negative_unless_allowed": "allow_negative_balance OR balance_minor >= 0",
		"ledger_accounts_totals_not_negative":                 "debits_total_minor >= 0 AND credits_total_minor >= 0",
	})}
}

func (LedgerAccount) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LedgerAccount) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").NotEmpty().MaxLen(200).Immutable(),
		field.String("currency").NotEmpty().MaxLen(8).Immutable(),
		field.Enum("kind").Values("asset", "liability", "equity", "revenue", "expense").Immutable(),
		field.Enum("normal_side").Values("debit", "credit").Immutable(),
		field.String("owner_type").MaxLen(40).Default("").Immutable(),
		field.String("owner_id").MaxLen(80).Default("").Immutable(),
		field.Bool("allow_negative_balance").Default(false).Immutable(),
		field.Int64("balance_minor").Default(0),
		field.Int64("debits_total_minor").Default(0),
		field.Int64("credits_total_minor").Default(0),
		field.Int64("version").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LedgerAccount) Edges() []ent.Edge {
	return []ent.Edge{edge.To("lines", JournalLine.Type)}
}

func (LedgerAccount) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("code", "currency").Unique(),
		index.Fields("code").Annotations(entsql.OpClass("varchar_pattern_ops")).StorageKey("ledgeraccount_code_pattern"),
		index.Fields("owner_type", "owner_id"),
	}
}
