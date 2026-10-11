package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type LiveHostDefault struct {
	ent.Schema
}

func (LiveHostDefault) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Bool("comments_enabled").Default(true),
		field.Enum("comment_audience").Values("everyone", "followers", "subscribers").Default("everyone"),
		field.Int("slow_mode_seconds").Default(0),
		field.JSON("blocked_words", []string{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.JSON("moderator_ids", []string{}).Optional().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}
