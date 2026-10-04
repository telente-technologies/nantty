package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SecurityAccountState struct {
	ent.Schema
}

func (SecurityAccountState) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Bool("challenge_required").Default(false),
		field.String("challenge_reason").MaxLen(40).Default(""),
		field.Time("flagged_at").Optional().Nillable(),
		field.Time("cleared_until").Optional().Nillable(),
		field.Bool("suspected_bot").Default(false),
		field.Float("bot_score").Default(0),
		field.Strings("bot_reasons").Default([]string{}),
		field.Time("bot_marked_at").Optional().Nillable(),
		field.Bool("headless_reported").Default(false),
		field.String("attestation_verdict").MaxLen(20).Default(""),
		field.Time("auto_suspended_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (SecurityAccountState) Indexes() []ent.Index {
	return []ent.Index{index.Fields("challenge_required"), index.Fields("suspected_bot")}
}
