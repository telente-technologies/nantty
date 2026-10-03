package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ReconciliationRun struct {
	ent.Schema
}

func (ReconciliationRun) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReconciliationRun) Fields() []ent.Field {
	return []ent.Field{
		field.String("provider").NotEmpty().MaxLen(40).Immutable(),
		field.Time("window_starts_at").Immutable(),
		field.Time("window_ends_at").Immutable(),
		field.Int("matched_count").NonNegative().Immutable(),
		field.Int("break_count").NonNegative().Immutable(),
	}
}

func (ReconciliationRun) Edges() []ent.Edge {
	return []ent.Edge{edge.To("breaks", ReconciliationBreak.Type)}
}

func (ReconciliationRun) Indexes() []ent.Index {
	return []ent.Index{index.Fields("provider", "window_starts_at")}
}

type ReconciliationBreak struct {
	ent.Schema
}

func (ReconciliationBreak) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ReconciliationBreak) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("run_id", uuid.UUID{}).Immutable(),
		field.Enum("kind").Values("missingInLedger", "missingAtProvider", "amountMismatch", "currencyMismatch").Immutable(),
		field.String("provider_reference").NotEmpty().MaxLen(255).Immutable(),
		field.String("currency").MaxLen(8).Default("").Immutable(),
		field.Int64("expected_amount_minor").Default(0).Immutable(),
		field.Int64("provider_amount_minor").Default(0).Immutable(),
		field.UUID("journal_entry_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.Time("resolved_at").Optional().Nillable(),
		field.String("resolution_note").MaxLen(500).Default(""),
	}
}

func (ReconciliationBreak) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("run", ReconciliationRun.Type).Ref("breaks").Field("run_id").Unique().Required().Immutable(),
	}
}

func (ReconciliationBreak) Indexes() []ent.Index {
	return []ent.Index{index.Fields("provider_reference"), index.Fields("resolved_at")}
}
