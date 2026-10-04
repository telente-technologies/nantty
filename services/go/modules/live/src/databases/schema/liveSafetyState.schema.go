package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type LiveSafetyState struct {
	ent.Schema
}

func (LiveSafetyState) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (LiveSafetyState) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("live_id", uuid.UUID{}).Immutable(),
		field.UUID("host_id", uuid.UUID{}).Immutable(),
		field.Bool("hold_active").Default(false),
		field.String("hold_incident_id").MaxLen(64).Default(""),
		field.String("hold_category").MaxLen(40).Default(""),
		field.String("hold_reason").MaxLen(300).Default(""),
		field.String("hold_source").MaxLen(20).Default(""),
		field.Time("hold_started_at").Optional().Nillable(),
		field.String("warning_message").MaxLen(300).Default(""),
		field.Time("warned_at").Optional().Nillable(),
		field.Time("sampling_boost_until").Optional().Nillable(),
		field.String("frame_egress_id").MaxLen(80).Default(""),
		field.String("audio_egress_id").MaxLen(80).Default(""),
		field.String("last_frame_key").MaxLen(512).Default(""),
		field.Time("last_frame_enqueued_at").Optional().Nillable(),
		field.String("last_audio_key").MaxLen(512).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (LiveSafetyState) Indexes() []ent.Index {
	return []ent.Index{index.Fields("live_id").Unique(), index.Fields("hold_active")}
}
