package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type PointsEntry struct {
	ent.Schema
}

func (PointsEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (PointsEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("type").Values("engagement", "support", "stream", "community", "achievement").Immutable(),
		field.Int64("amount").Positive().Immutable(),
		field.String("source_type").NotEmpty().Immutable(),
		field.String("source_id").Default("").Immutable(),
		field.UUID("live_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.UUID("host_user_id", uuid.UUID{}).Optional().Nillable().Immutable(),
		field.String("category_id").Default("").Immutable(),
		field.String("country_code").Default("").MaxLen(2).Immutable(),
		field.Bool("host_is_creator").Default(false).Immutable(),
		field.String("idempotency_key").NotEmpty().Immutable().Unique(),
	}
}

func (PointsEntry) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id", "user_id"),
		index.Fields("type", "created_at"),
		index.Fields("user_id", "source_type", "created_at"),
		index.Fields("country_code", "type", "created_at"),
		index.Fields("category_id", "type", "created_at"),
	}
}

type PointsRule struct {
	ent.Schema
}

func (PointsRule) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Immutable(),
		field.Int64("points").NonNegative(),
		field.Int("per_minute_cap").Default(0),
		field.Int("per_day_cap").Default(0),
		field.Int("per_live_cap").Default(0),
		field.Bool("active").Default(true),
	}
}

type LiveLeaderboardEntry struct {
	ent.Schema
}

func (LiveLeaderboardEntry) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveLeaderboardEntry) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Int("rank").Positive().Immutable(),
		field.Int64("coins").Default(0).Immutable(),
		field.Int64("points").Default(0).Immutable(),
	}
}

func (LiveLeaderboardEntry) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id", "user_id").Unique(), index.Fields("live_id", "rank")}
}
