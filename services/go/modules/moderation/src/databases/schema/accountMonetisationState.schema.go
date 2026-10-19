package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type AccountMonetisationState struct {
	ent.Schema
}

func (AccountMonetisationState) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Bool("last_can_monetise").Default(true),
		field.Time("last_published_at").Optional().Nillable(),
		field.Enum("override_mode").Values("allow", "pause").Optional().Nillable(),
		field.String("override_reason").MaxLen(1000).Default(""),
		field.String("override_actor_id").MaxLen(64).Default(""),
		field.String("override_actor_name").MaxLen(120).Default(""),
		field.Int("override_active_strike_count").Default(0).Min(0),
		field.Time("override_set_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now),
	}
}
