package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Battle struct {
	ent.Schema
}

func (Battle) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Battle) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("host_id", uuid.UUID{}).Immutable(),
		field.Enum("state").Values("pending", "countdown", "active", "ended", "settled", "cancelled").Default("pending"),
		field.Bool("winner_takes_all").Default(false),
		field.Int("duration_seconds").Immutable(),
		field.String("idempotency_key").NotEmpty().Immutable(),
		field.Time("proposal_expires_at").Optional().Nillable(),
		field.Time("host_decision_deadline_at").Optional().Nillable(),
		field.Time("countdown_started_at").Optional().Nillable(),
		field.Time("starts_at").Optional().Nillable(),
		field.Time("ends_at").Optional().Nillable(),
		field.Enum("end_reason").Values("timer", "hostEnded", "hostEndedLive", "forfeit").Optional().Nillable(),
		field.Time("settled_at").Optional().Nillable(),
		field.Int("settlement_attempts").Default(0),
		field.Time("settlement_lease_until").Optional().Nillable(),
		field.Time("settlement_next_attempt_at").Optional().Nillable(),
		field.String("settlement_lease_token").Optional().Nillable(),
		field.JSON("winner_user_ids", []string{}).Default([]string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Bool("is_tie").Default(false),
		field.JSON("settlement", map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (Battle) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("live_id").Unique().Annotations(entsql.IndexWhere("state IN ('pending','countdown','active','ended')")),
		index.Fields("live_id", "idempotency_key").Unique(),
		index.Fields("state", "ends_at"),
		index.Fields("state", "settlement_next_attempt_at", "settlement_lease_until"),
		index.Fields("state", "starts_at"),
		index.Fields("state", "proposal_expires_at"),
	}
}

type BattleParticipant struct {
	ent.Schema
}

func (BattleParticipant) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (BattleParticipant) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("battle_id", uuid.UUID{}).Immutable(),
		field.UUID("user_id", uuid.UUID{}).Immutable(),
		field.Enum("state").Values("active", "left", "forfeited").Default("active"),
		field.Enum("consent").Values("pending", "accepted", "declined").Default("accepted"),
		field.Int64("score").Default(0),
		field.Bool("is_creator_program_member").Default(false),
		field.Bool("removed_by_host").Default(false),
	}
}

func (BattleParticipant) Indexes() []ent.Index {
	return []ent.Index{index.Fields("battle_id", "user_id").Unique(), index.Fields("user_id", "state")}
}
