package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type AdCreatorMonetisationHold struct {
	ent.Schema
}

func (AdCreatorMonetisationHold) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(80).Immutable(),
		field.Bool("is_paused").Default(false),
		field.Time("health_changed_at"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}
