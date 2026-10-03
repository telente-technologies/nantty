package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type GiftGoal struct {
	ent.Schema
}

func (GiftGoal) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (GiftGoal) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("creator_id", uuid.UUID{}).Immutable(),
		field.String("title").NotEmpty().MaxLen(80),
		field.Int64("target_coins").Positive(),
		field.String("gift_id").Optional().Nillable(),
		field.Int64("progress_coins").Default(0),
		field.Enum("status").Values("active", "completed", "cancelled").Default("active"),
		field.Time("completed_at").Optional().Nillable(),
	}
}

func (GiftGoal) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "status")}
}
