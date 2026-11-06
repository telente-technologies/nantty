package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
	"time"
)

type Space struct{ ent.Schema }

func (Space) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (Space) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("host_id", uuid.UUID{}).Immutable(),
		field.String("title").NotEmpty().MaxLen(140),
		field.String("description").Default("").MaxLen(2000),
		field.Enum("state").Values("scheduled", "live", "ended", "cancelled").Default("scheduled"),
		field.Enum("visibility").Values("public", "followers", "subscribers").Default("public"),
		field.Time("scheduled_at").Optional().Nillable(),
		field.Time("started_at").Optional().Nillable(),
		field.Time("ended_at").Optional().Nillable(),
		field.String("livekit_room").NotEmpty().Unique().Immutable(),
		field.Int("listeners").Default(0),
		field.Int("peak_listeners").Default(0),
		field.String("moderation_visibility").Default("visible"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
		field.Bool("gifts_enabled").Default(false),
		field.Bool("video_enabled").Default(false).Immutable(),
		field.JSON("metadata", map[string]any{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
	}
}

func (Space) Indexes() []ent.Index {
	return []ent.Index{index.Fields("state", "scheduled_at"), index.Fields("host_id", "state")}
}
