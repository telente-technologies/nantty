package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type LiveHostRestriction struct {
	ent.Schema
}

func (LiveHostRestriction) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable(),
		field.Bool("can_go_live").Default(true),
		field.Time("health_changed_at"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}
