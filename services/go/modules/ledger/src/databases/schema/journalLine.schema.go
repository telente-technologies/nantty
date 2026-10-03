package schema

import (
	"context"
	"errors"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type JournalLine struct {
	ent.Schema
}

func (JournalLine) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{
		"journal_lines_amount_positive": "amount_minor > 0",
	})}
}

func (JournalLine) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (JournalLine) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("entry_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("direction").Values("debit", "credit").Immutable(),
		field.Int64("amount_minor").Positive().Immutable(),
		field.String("currency").NotEmpty().MaxLen(8).Immutable(),
		field.Int("line_number").NonNegative().Immutable(),
		field.Int64("balance_after_minor").Immutable(),
	}
}

func (JournalLine) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("entry", JournalEntry.Type).Ref("lines").Field("entry_id").Unique().Required().Immutable(),
		edge.From("account", LedgerAccount.Type).Ref("lines").Field("account_id").Unique().Required().Immutable(),
	}
}

func (JournalLine) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("account_id", "id").Annotations(entsql.DescColumns("id")),
		index.Fields("entry_id", "line_number").Unique(),
	}
}

func (JournalLine) Hooks() []ent.Hook {
	return []ent.Hook{rejectUpdatesAndDeletesOfPostedRows()}
}

var ErrPostedLedgerRowsAreImmutable = errors.New("posted journal entries and lines are immutable; post a reversal instead")

func rejectUpdatesAndDeletesOfPostedRows() ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, mutation ent.Mutation) (ent.Value, error) {
			if !mutation.Op().Is(ent.OpCreate) {
				return nil, ErrPostedLedgerRowsAreImmutable
			}
			return next.Mutate(ctx, mutation)
		})
	}
}
