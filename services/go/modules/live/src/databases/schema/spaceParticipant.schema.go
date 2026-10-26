package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type SpaceParticipant struct{ ent.Schema }

func (SpaceParticipant) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (SpaceParticipant) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("space_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("role").Values("host", "listener", "speaker").Default("listener"),
		field.Enum("state").Values("active", "left", "removed").Default("active"),
		field.Bool("muted_by_host").Default(false),
		field.Time("joined_at").Default(time.Now),
		field.Time("last_seen_at").Default(time.Now).UpdateDefault(time.Now),
		field.Time("left_at").Optional().Nillable(),
	}
}

func (SpaceParticipant) Indexes() []ent.Index {
	return []ent.Index{index.Fields("space_id", "account_id").Unique(), index.Fields("space_id", "state", "role"), index.Fields("state", "last_seen_at")}
}
